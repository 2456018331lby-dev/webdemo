import { describe, expect, it } from 'vitest';
import type { CompanyResearchRecord, JobPosting, JobScore, QueueState } from '../src';
import { enqueueScoredJobs, getNextActionableItem, getNextRunnableItem, markQueueItemAttempted, rankQueueItemsByCompany, reconcileScoredQueue } from '../src';

const job: JobPosting = {
  id: 'job-1',
  platform: 'boss',
  title: '前端工程师',
  company: { name: 'Example', tags: [] },
  description: 'React TypeScript',
  requirements: ['React'],
  tags: ['React'],
  scrapedAt: '2026-06-08T00:00:00.000Z'
};

const score: JobScore = {
  jobId: 'job-1',
  score: 88,
  recommendation: 'apply',
  reasons: [],
  matchedSkills: ['React'],
  triggeredBlacklistRules: []
};

const emptyState: QueueState = {
  items: [],
  applicationsToday: 0,
  dayKey: '2026-06-08'
};

describe('queue policy', () => {
  it('queues apply recommendations in auto mode', () => {
    const state = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'auto' }
    });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.status).toBe('queued');
    expect(getNextRunnableItem(state, { dailyLimit: 1 }, '2026-06-08T01:00:01.000Z')?.job.id).toBe('job-1');
  });

  it('queues dry-run apply recommendations without requiring real clicks', () => {
    const state = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run' }
    });

    expect(state.items[0]?.status).toBe('queued');
    expect(getNextRunnableItem(state, { mode: 'dry-run' }, '2026-06-08T01:00:01.000Z')?.job.id).toBe('job-1');
  });

  it('requires approval in manual approval mode', () => {
    const state = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'manual-approval' }
    });

    expect(state.items[0]?.status).toBe('needs-approval');
    expect(state.items[0]?.pauseReason).toBe('manual-review-required');
    expect(getNextActionableItem(state, { mode: 'manual-approval' }, '2026-06-08T01:00:01.000Z')?.job.id).toBe('job-1');
  });

  it('holds the next queued item until the minimum interval passes', () => {
    const secondJob = { ...job, id: 'job-2', company: { name: 'Second', tags: [] } };
    const state = enqueueScoredJobs(emptyState, [{ job, score }, { job: secondJob, score: { ...score, jobId: 'job-2', score: 82 } }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run', minMinutesBetweenActions: 8 }
    });
    const first = getNextRunnableItem(state, { mode: 'dry-run', minMinutesBetweenActions: 8 }, '2026-06-08T01:00:01.000Z');
    const attempted = markQueueItemAttempted(state, first!.id, '2026-06-08T01:00:02.000Z', { minMinutesBetweenActions: 8 }, true);

    expect(getNextRunnableItem(attempted, { mode: 'dry-run', minMinutesBetweenActions: 8 }, '2026-06-08T01:07:59.000Z')).toBeUndefined();
    expect(getNextRunnableItem(attempted, { mode: 'dry-run', minMinutesBetweenActions: 8 }, '2026-06-08T01:08:02.000Z')?.job.id).toBe('job-2');
  });

  it('keeps manual approval attempts in needs-approval status', () => {
    const state = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'manual-approval' }
    });
    const attempted = markQueueItemAttempted(state, state.items[0]!.id, '2026-06-08T01:00:02.000Z', { minMinutesBetweenActions: 8 }, false, 'manual-review-required');

    expect(attempted.items[0]?.status).toBe('needs-approval');
    expect(attempted.items[0]?.pauseReason).toBe('manual-review-required');
  });

  it('keeps jobs grouped inside the best-ranked company before moving to the next company', () => {
    const bestCompanyHighJob = {
      job: { ...job, id: 'a-high', company: { name: 'Alpha', tags: [] } },
      score: { ...score, jobId: 'a-high', score: 78, companyScore: 92 }
    };
    const bestCompanyLowerJob = {
      job: { ...job, id: 'a-lower', title: 'React 工程师', company: { name: 'Alpha', tags: [] } },
      score: { ...score, jobId: 'a-lower', score: 48, companyScore: 40 }
    };
    const secondCompanyBestJob = {
      job: { ...job, id: 'b-best', company: { name: 'Beta', tags: [] } },
      score: { ...score, jobId: 'b-best', score: 96, companyScore: 84 }
    };

    const state = enqueueScoredJobs(emptyState, [bestCompanyHighJob, secondCompanyBestJob, bestCompanyLowerJob], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run' }
    });

    expect(state.items.map((item) => item.job.id)).toEqual(['a-high', 'a-lower', 'b-best']);
  });

  it('exposes company rank and job rank metadata for queue display', () => {
    const state = enqueueScoredJobs(
      emptyState,
      [
        {
          job: { ...job, id: 'alpha-1', company: { name: 'Alpha', tags: [] } },
          score: { ...score, jobId: 'alpha-1', score: 91, companyScore: 88 }
        },
        {
          job: { ...job, id: 'alpha-2', title: '前端开发', company: { name: 'Alpha', tags: [] } },
          score: { ...score, jobId: 'alpha-2', score: 86, companyScore: 82 }
        },
        {
          job: { ...job, id: 'beta-1', company: { name: 'Beta', tags: [] } },
          score: { ...score, jobId: 'beta-1', score: 90, companyScore: 75 }
        }
      ],
      {
        nowIso: '2026-06-08T01:00:00.000Z',
        policy: { mode: 'dry-run' }
      }
    );

    const ranked = rankQueueItemsByCompany(state.items);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.companyName).toBe('Alpha');
    expect(ranked[0]?.companyRank).toBe(1);
    expect(ranked[0]?.items.map((item) => item.jobRankInCompany)).toEqual([1, 2]);
    expect(ranked[1]?.companyName).toBe('Beta');
    expect(ranked[1]?.companyRank).toBe(2);
  });

  it('reconciles newly scored jobs into an empty queue after resume save', () => {
    const state = reconcileScoredQueue(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run' }
    });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.job.id).toBe('job-1');
    expect(state.items[0]?.status).toBe('queued');
  });

  it('reconciles existing items when blacklist rules change', () => {
    const queued = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run' }
    });
    const blacklistedScore: JobScore = {
      ...score,
      triggeredBlacklistRules: [{ id: 'b1', kind: 'company', value: 'Example', enabled: true }]
    };

    const reconciled = reconcileScoredQueue(queued, [{ job, score: blacklistedScore }], {
      nowIso: '2026-06-08T01:10:00.000Z',
      policy: { mode: 'dry-run' }
    });

    expect(reconciled.items[0]?.status).toBe('skipped');
    expect(reconciled.items[0]?.pauseReason).toBe('blacklisted');
  });

  it('keeps apply recommendations in needs-approval status in manual mode after rescoring', () => {
    const queued = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'dry-run' }
    });

    const reconciled = reconcileScoredQueue(queued, [{ job, score }], {
      nowIso: '2026-06-08T01:10:00.000Z',
      policy: { mode: 'manual-approval' }
    });

    expect(reconciled.items[0]?.status).toBe('needs-approval');
    expect(reconciled.items[0]?.pauseReason).toBe('manual-review-required');
  });

  it('requeues missing-research pauses when matching research is saved', () => {
    const queued = enqueueScoredJobs(emptyState, [{ job, score }], {
      nowIso: '2026-06-08T01:00:00.000Z',
      policy: { mode: 'auto', requireResearchBeforeAuto: true }
    });
    const paused = markQueueItemAttempted(
      queued,
      queued.items[0]!.id,
      '2026-06-08T01:01:00.000Z',
      { mode: 'auto', minMinutesBetweenActions: 8, requireResearchBeforeAuto: true },
      false,
      'missing-research'
    );
    const unrelatedResearch: CompanyResearchRecord = {
      id: 'research-other',
      companyName: 'Other',
      jobTitle: '前端工程师',
      capturedAt: '2026-06-08T01:02:00.000Z',
      summary: '薪资 25-35K，周末双休。',
      benefits: [],
      warnings: [],
      confidence: 'medium'
    };
    const matchingResearch: CompanyResearchRecord = {
      ...unrelatedResearch,
      id: 'research-example',
      companyName: 'Example',
      capturedAt: '2026-06-08T01:03:00.000Z'
    };

    const stillPaused = reconcileScoredQueue(paused, [{ job, score }], {
      nowIso: '2026-06-08T01:02:00.000Z',
      policy: { mode: 'auto', requireResearchBeforeAuto: true },
      research: [unrelatedResearch]
    });
    const recovered = reconcileScoredQueue(paused, [{ job, score }], {
      nowIso: '2026-06-08T01:03:00.000Z',
      policy: { mode: 'auto', requireResearchBeforeAuto: true },
      research: [matchingResearch]
    });

    expect(stillPaused.items[0]?.status).toBe('paused');
    expect(stillPaused.items[0]?.pauseReason).toBe('missing-research');
    expect(recovered.items[0]?.status).toBe('queued');
    expect(recovered.items[0]?.pauseReason).toBeUndefined();
    expect(recovered.items[0]?.nextRunAt).toBe('2026-06-08T01:03:00.000Z');
  });
});

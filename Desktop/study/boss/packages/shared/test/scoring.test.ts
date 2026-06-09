import { describe, expect, it } from 'vitest';
import type { JobPosting, ResumeProfile } from '../src';
import { scoreJob } from '../src';

const resume: ResumeProfile = {
  targetTitles: ['前端工程师'],
  targetLocations: ['上海'],
  skills: ['React', 'TypeScript', 'Node'],
  industries: ['SaaS'],
  rawText: 'React TypeScript Node 前端工程师 SaaS 上海'
};

const job: JobPosting = {
  id: 'job-1',
  platform: 'boss',
  title: '高级前端工程师',
  company: {
    name: 'Example SaaS',
    industry: 'SaaS',
    size: '100-499人',
    tags: ['双休']
  },
  location: '上海',
  salary: { min: 25000, max: 35000, currency: 'CNY', period: 'month', raw: '25-35K' },
  description: '负责 React TypeScript Node 相关业务平台建设，提供五险一金、年终奖、带薪年假。',
  requirements: ['React', 'TypeScript'],
  tags: ['React', 'TypeScript'],
  scrapedAt: '2026-06-08T00:00:00.000Z'
};

describe('scoreJob', () => {
  it('recommends matching jobs for application', () => {
    const result = scoreJob(job, resume);

    expect(result.score).toBeGreaterThanOrEqual(72);
    expect(result.recommendation).toBe('apply');
    expect(result.matchedSkills).toEqual(['React', 'TypeScript', 'Node']);
    expect(result.companyGrade).toBe('A');
    expect(result.compensationScore).toBeGreaterThanOrEqual(70);
    expect(result.workLifeScore).toBe(100);
    expect(result.reasons.map((reason) => reason.key)).toEqual(expect.arrayContaining(['bonus', 'benefits', 'rest', 'annualLeave']));
  });

  it('skips jobs that match enabled blacklist rules', () => {
    const result = scoreJob(job, resume, {
      blacklist: [{ id: 'b1', kind: 'company', value: 'Example', reason: '已沟通过', enabled: true }]
    });

    expect(result.recommendation).toBe('skip');
    expect(result.triggeredBlacklistRules).toHaveLength(1);
    expect(result.reasons[0]?.key).toBe('blacklist');
  });

  it('scores otherwise equal jobs by salary level instead of salary presence only', () => {
    const sparseResume: ResumeProfile = {
      targetTitles: ['前端工程师'],
      targetLocations: ['上海'],
      skills: ['React'],
      industries: [],
      rawText: 'React 前端工程师 上海'
    };
    const baseJob: JobPosting = {
      ...job,
      company: { name: 'Salary Test', tags: [] },
      description: 'React',
      requirements: ['React'],
      tags: [],
      salary: undefined
    };

    const lowSalary = scoreJob(
      { ...baseJob, id: 'low-salary', salary: { min: 8000, max: 10_000, currency: 'CNY', period: 'month', raw: '8-10K' } },
      sparseResume
    );
    const highSalary = scoreJob(
      { ...baseJob, id: 'high-salary', salary: { min: 35_000, max: 45_000, currency: 'CNY', period: 'month', raw: '35-45K' } },
      sparseResume
    );

    expect(highSalary.score).toBeGreaterThan(lowSalary.score);
    expect(highSalary.compensationScore).toBeGreaterThan(lowSalary.compensationScore ?? 0);
    expect(highSalary.reasons.find((reason) => reason.key === 'salary')?.detail).toContain('薪资等级 90');
  });
});

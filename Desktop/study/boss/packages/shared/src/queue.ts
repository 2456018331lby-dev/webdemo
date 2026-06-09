import type { JobPosting, JobScore, QueueItem, QueuePolicy } from './types';
import { addMinutes, stableId } from './text';
import { defaultQueuePolicy } from './types';
import { flattenRankedQueueItems } from './ranking';

export interface QueueState {
  items: QueueItem[];
  applicationsToday: number;
  dayKey: string;
  lastApplicationAt?: string;
}

export interface EnqueueOptions {
  policy?: Partial<QueuePolicy>;
  nowIso: string;
}

export function createQueueItem(job: JobPosting, score: JobScore, nowIso: string, policy: QueuePolicy): QueueItem {
  const needsApproval = policy.mode === 'manual-approval' || score.recommendation !== 'apply';
  const blacklisted = score.triggeredBlacklistRules.length > 0;

  return {
    id: stableId([job.platform, job.id, nowIso]),
    job,
    score,
    status: blacklisted ? 'skipped' : needsApproval ? 'needs-approval' : 'queued',
    createdAt: nowIso,
    updatedAt: nowIso,
    attempts: 0,
    nextRunAt: needsApproval || blacklisted ? undefined : nowIso,
    pauseReason: blacklisted ? 'blacklisted' : needsApproval ? 'manual-review-required' : undefined
  };
}

export function enqueueScoredJobs(
  state: QueueState,
  scoredJobs: Array<{ job: JobPosting; score: JobScore }>,
  options: EnqueueOptions
): QueueState {
  const policy = { ...defaultQueuePolicy, ...options.policy };
  const existingKeys = new Set(state.items.map((item) => `${item.job.platform}:${item.job.id}`));
  const nextItems = [...state.items];

  for (const scored of scoredJobs) {
    if (nextItems.length >= policy.maxQueueSize) break;
    const key = `${scored.job.platform}:${scored.job.id}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    nextItems.push(createQueueItem(scored.job, scored.score, options.nowIso, policy));
  }

  return { ...state, items: sortQueue(nextItems) };
}

export function getNextRunnableItem(state: QueueState, policyInput: Partial<QueuePolicy>, nowIso: string): QueueItem | undefined {
  const policy = { ...defaultQueuePolicy, ...policyInput };
  if (state.applicationsToday >= policy.dailyLimit) return undefined;
  if (state.lastApplicationAt && new Date(addMinutes(state.lastApplicationAt, policy.minMinutesBetweenActions)).getTime() > new Date(nowIso).getTime()) {
    return undefined;
  }

  return sortQueue(state.items).find((item) => {
    if (item.status !== 'queued') return false;
    if (!item.nextRunAt) return true;
    return new Date(item.nextRunAt).getTime() <= new Date(nowIso).getTime();
  });
}

export function getNextActionableItem(state: QueueState, policyInput: Partial<QueuePolicy>, nowIso: string): QueueItem | undefined {
  const policy = { ...defaultQueuePolicy, ...policyInput };
  if (policy.mode !== 'manual-approval') return getNextRunnableItem(state, policy, nowIso);
  if (state.applicationsToday >= policy.dailyLimit) return undefined;
  if (state.lastApplicationAt && new Date(addMinutes(state.lastApplicationAt, policy.minMinutesBetweenActions)).getTime() > new Date(nowIso).getTime()) {
    return undefined;
  }

  return sortQueue(state.items).find((item) => {
    if (item.score.recommendation !== 'apply') return false;
    if (item.status !== 'queued' && item.status !== 'needs-approval') return false;
    if (!item.nextRunAt) return true;
    return new Date(item.nextRunAt).getTime() <= new Date(nowIso).getTime();
  });
}

export function markQueueItemAttempted(
  state: QueueState,
  itemId: string,
  nowIso: string,
  policyInput: Partial<QueuePolicy>,
  ok: boolean,
  pauseReason: QueueItem['pauseReason'] = 'platform-warning'
): QueueState {
  const policy = { ...defaultQueuePolicy, ...policyInput };
  const applicationsToday = ok ? state.applicationsToday + 1 : state.applicationsToday;

  return {
    ...state,
    applicationsToday,
    lastApplicationAt: ok ? nowIso : state.lastApplicationAt,
    items: state.items.map((item) => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        status: ok ? 'completed' : pauseReason === 'manual-review-required' ? 'needs-approval' : 'paused',
        attempts: item.attempts + 1,
        updatedAt: nowIso,
        nextRunAt: ok ? undefined : addMinutes(nowIso, policy.minMinutesBetweenActions),
        pauseReason: ok ? undefined : pauseReason
      };
    })
  };
}

export function rotateDay(state: QueueState, nowIso: string): QueueState {
  const nextDayKey = nowIso.slice(0, 10);
  if (state.dayKey === nextDayKey) return state;
  return { ...state, dayKey: nextDayKey, applicationsToday: 0 };
}

function sortQueue(items: QueueItem[]): QueueItem[] {
  return flattenRankedQueueItems(items);
}

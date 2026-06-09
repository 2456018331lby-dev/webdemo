import type { QueueItem, ScoreGrade, ScoreReason } from './types';
import { normalizeText } from './text';

export interface RankedCompanyGroup {
  companyKey: string;
  companyName: string;
  companyRank: number;
  companyScore: number;
  companyGrade: ScoreGrade;
  companyReasons: ScoreReason[];
  bestJobScore: number;
  items: RankedQueueItem[];
}

export interface RankedQueueItem {
  item: QueueItem;
  companyRank: number;
  jobRankInCompany: number;
  companyScore: number;
  companyGrade: ScoreGrade;
}

interface PendingCompanyGroup {
  companyKey: string;
  companyName: string;
  items: QueueItem[];
  companyScore: number;
  bestJobScore: number;
  firstCreatedAt: number;
}

const RECOMMENDATION_ORDER: Record<QueueItem['score']['recommendation'], number> = {
  apply: 0,
  review: 1,
  skip: 2
};

const COMPANY_REASON_KEYS = new Set(['industry', 'salary', 'bonus', 'benefits', 'rest', 'annualLeave', 'company', 'research']);

export function rankQueueItemsByCompany(items: QueueItem[]): RankedCompanyGroup[] {
  const groupsByCompany = new Map<string, PendingCompanyGroup>();

  for (const item of items) {
    const companyKey = getCompanyKey(item);
    const existing = groupsByCompany.get(companyKey);
    const companyScore = getCompanyScore(item);
    const createdAt = getTime(item.createdAt);

    if (!existing) {
      groupsByCompany.set(companyKey, {
        companyKey,
        companyName: item.job.company.name,
        items: [item],
        companyScore,
        bestJobScore: item.score.score,
        firstCreatedAt: createdAt
      });
      continue;
    }

    existing.items.push(item);
    existing.companyScore = Math.max(existing.companyScore, companyScore);
    existing.bestJobScore = Math.max(existing.bestJobScore, item.score.score);
    existing.firstCreatedAt = Math.min(existing.firstCreatedAt, createdAt);
  }

  return Array.from(groupsByCompany.values())
    .sort(compareCompanyGroups)
    .map((group, groupIndex) => {
      const companyRank = groupIndex + 1;
      const companyGrade = toGrade(group.companyScore);
      return {
        companyKey: group.companyKey,
        companyName: group.companyName,
        companyRank,
        companyScore: group.companyScore,
        companyGrade,
        companyReasons: getCompanyReasons(group.items),
        bestJobScore: group.bestJobScore,
        items: sortJobsWithinCompany(group.items).map((item, itemIndex) => ({
          item,
          companyRank,
          jobRankInCompany: itemIndex + 1,
          companyScore: group.companyScore,
          companyGrade
        }))
      };
    });
}

export function flattenRankedQueueItems(items: QueueItem[]): QueueItem[] {
  return rankQueueItemsByCompany(items).flatMap((group) => group.items.map((rankedItem) => rankedItem.item));
}

function compareCompanyGroups(left: PendingCompanyGroup, right: PendingCompanyGroup): number {
  if (left.companyScore !== right.companyScore) return right.companyScore - left.companyScore;
  if (left.bestJobScore !== right.bestJobScore) return right.bestJobScore - left.bestJobScore;
  if (left.firstCreatedAt !== right.firstCreatedAt) return left.firstCreatedAt - right.firstCreatedAt;
  return left.companyName.localeCompare(right.companyName);
}

function sortJobsWithinCompany(items: QueueItem[]): QueueItem[] {
  return [...items].sort((left, right) => {
    const recommendationDelta = RECOMMENDATION_ORDER[left.score.recommendation] - RECOMMENDATION_ORDER[right.score.recommendation];
    if (recommendationDelta !== 0) return recommendationDelta;
    if (left.score.score !== right.score.score) return right.score.score - left.score.score;
    if ((left.score.jobFitScore ?? 0) !== (right.score.jobFitScore ?? 0)) return (right.score.jobFitScore ?? 0) - (left.score.jobFitScore ?? 0);
    return getTime(left.createdAt) - getTime(right.createdAt);
  });
}

function getCompanyKey(item: QueueItem): string {
  return normalizeText(item.job.company.id ?? item.job.company.name);
}

function getCompanyScore(item: QueueItem): number {
  return item.score.companyScore ?? item.score.score;
}

function getCompanyReasons(items: QueueItem[]): ScoreReason[] {
  const reasonsByKey = new Map<string, ScoreReason>();

  for (const item of items) {
    for (const reason of item.score.reasons) {
      if (!COMPANY_REASON_KEYS.has(reason.key)) continue;
      const existing = reasonsByKey.get(reason.key);
      if (!existing || Math.abs(reason.delta) > Math.abs(existing.delta)) {
        reasonsByKey.set(reason.key, reason);
      }
    }
  }

  return Array.from(reasonsByKey.values())
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);
}

function getTime(iso: string): number {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toGrade(score: number): ScoreGrade {
  if (score >= 85) return 'S';
  if (score >= 72) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

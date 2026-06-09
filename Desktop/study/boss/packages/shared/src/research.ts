import type { CompanyResearchRecord, JobPosting, MoneyRange } from './types';
import { includesNormalized, normalizeText, stableId } from './text';

export interface ResearchParseInput {
  companyName: string;
  jobTitle?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  summary: string;
  capturedAt: string;
}

export interface ResearchSignal {
  record: CompanyResearchRecord;
  records: CompanyResearchRecord[];
  sourceCount: number;
  score: number;
  reasons: string[];
}

export interface ResearchPageCaptureInput {
  companyName: string;
  jobTitle?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  pageText: string;
  capturedAt: string;
}

const BENEFIT_KEYWORDS = ['五险一金', '六险一金', '补充医疗', '餐补', '房补', '交通补贴', '定期体检', '节日福利', '带薪病假', '培训预算'];
const BONUS_KEYWORDS = ['年终奖', '十三薪', '14薪', '15薪', '16薪', '绩效奖金', '项目奖金', '股票期权', '期权', 'bonus'];
const GOOD_REST_KEYWORDS = ['双休', '周末双休', '不加班', '弹性工作', '965', '955', '远程'];
const BAD_REST_KEYWORDS = ['单休', '大小周', '996', '007', '加班严重'];
const ANNUAL_LEAVE_KEYWORDS = ['年假', '带薪年假', '额外假期', '调休'];
const WARNING_KEYWORDS = ['裁员', '拖欠工资', '欠薪', '强制加班', '大小周', '单休', '996', '007', '外包', '培训贷'];

export function parseCompanyResearch(input: ResearchParseInput): CompanyResearchRecord {
  const summary = input.summary.trim();
  const benefits = matchedKeywords(summary, BENEFIT_KEYWORDS);
  const bonus = matchedKeywords(summary, BONUS_KEYWORDS).join('、') || undefined;
  const goodRest = matchedKeywords(summary, GOOD_REST_KEYWORDS);
  const badRest = matchedKeywords(summary, BAD_REST_KEYWORDS);
  const annualLeave = matchedKeywords(summary, ANNUAL_LEAVE_KEYWORDS).join('、') || undefined;
  const warnings = matchedKeywords(summary, WARNING_KEYWORDS);
  const salary = parseSalary(summary);

  return {
    id: stableId([input.companyName, input.jobTitle, input.sourceUrl, summary]),
    companyName: input.companyName.trim(),
    jobTitle: input.jobTitle?.trim() || undefined,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    sourceTitle: input.sourceTitle?.trim() || undefined,
    capturedAt: input.capturedAt,
    summary,
    salary,
    bonus,
    benefits,
    restSchedule: [...goodRest, ...badRest].join('、') || undefined,
    annualLeave,
    warnings,
    confidence: inferConfidence(summary, input.sourceUrl)
  };
}

export function createResearchFromPage(input: ResearchPageCaptureInput): CompanyResearchRecord {
  return parseCompanyResearch({
    companyName: input.companyName,
    jobTitle: input.jobTitle,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    summary: summarizeResearchPage(input.pageText, input.companyName, input.jobTitle),
    capturedAt: input.capturedAt
  });
}

export function buildResearchQuery(companyName: string, jobTitle?: string): string {
  return [companyName, jobTitle, '薪资', '奖金', '福利', '双休', '年假', '加班', '评价']
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');
}

export function getResearchForJob(job: JobPosting, records: CompanyResearchRecord[]): CompanyResearchRecord[] {
  return records.filter((record) => {
    if (!includesNormalized(record.companyName, job.company.name) && !includesNormalized(job.company.name, record.companyName)) return false;
    if (!record.jobTitle) return true;
    return includesNormalized(job.title, record.jobTitle) || includesNormalized(record.jobTitle, job.title);
  });
}

export function scoreResearchSignal(job: JobPosting, records: CompanyResearchRecord[]): ResearchSignal | undefined {
  const matchedRecords = getResearchForJob(job, records).sort(compareResearchRecords);
  const [record] = matchedRecords;
  if (!record) return undefined;

  const reasons: string[] = [];
  const sourceCount = matchedRecords.length;
  let score = Math.max(...matchedRecords.map((matchedRecord) => confidenceBase(matchedRecord.confidence)));

  if (sourceCount > 1) {
    score += Math.min(10, (sourceCount - 1) * 4);
    reasons.push(`资料来源：${sourceCount}条`);
  }

  const salaries = uniqueValues(matchedRecords.map((matchedRecord) => formatSalary(matchedRecord.salary)));
  if (salaries.length > 0) {
    score += 16;
    reasons.push(`外部薪资：${salaries.join('、')}`);
  }

  const bonuses = uniqueValues(matchedRecords.flatMap((matchedRecord) => splitSignal(matchedRecord.bonus)));
  if (bonuses.length > 0) {
    score += 10;
    reasons.push(`奖金：${bonuses.join('、')}`);
  }

  const benefits = uniqueValues(matchedRecords.flatMap((matchedRecord) => matchedRecord.benefits));
  if (benefits.length > 0) {
    score += Math.min(14, benefits.length * 4);
    reasons.push(`福利：${benefits.join('、')}`);
  }

  const annualLeaves = uniqueValues(matchedRecords.flatMap((matchedRecord) => splitSignal(matchedRecord.annualLeave)));
  if (annualLeaves.length > 0) {
    score += 8;
    reasons.push(`年假：${annualLeaves.join('、')}`);
  }

  const restSchedules = uniqueValues(matchedRecords.flatMap((matchedRecord) => splitSignal(matchedRecord.restSchedule)));
  const badRestMatches = restSchedules.filter((restSchedule) => BAD_REST_KEYWORDS.some((keyword) => includesNormalized(restSchedule, keyword)));
  const goodRestMatches = restSchedules.filter((restSchedule) => GOOD_REST_KEYWORDS.some((keyword) => includesNormalized(restSchedule, keyword)));
  if (badRestMatches.length > 0) {
    score -= 22;
    reasons.push(`休息负面：${badRestMatches.join('、')}`);
  } else if (goodRestMatches.length > 0) {
    score += 12;
    reasons.push(`休息：${goodRestMatches.join('、')}`);
  }

  const warnings = uniqueValues(matchedRecords.flatMap((matchedRecord) => matchedRecord.warnings));
  if (warnings.length > 0) {
    score -= Math.min(35, warnings.length * 12);
    reasons.push(`风险：${warnings.join('、')}`);
  }

  return {
    record,
    records: matchedRecords,
    sourceCount,
    score: Math.max(-50, Math.min(100, Math.round(score))),
    reasons
  };
}

function matchedKeywords(value: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => includesNormalized(value, keyword));
}

function summarizeResearchPage(pageText: string, companyName: string, jobTitle?: string): string {
  const normalized = pageText.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const markers = [
    companyName,
    jobTitle,
    ...BENEFIT_KEYWORDS,
    ...BONUS_KEYWORDS,
    ...GOOD_REST_KEYWORDS,
    ...BAD_REST_KEYWORDS,
    ...ANNUAL_LEAVE_KEYWORDS,
    ...WARNING_KEYWORDS,
    '薪资',
    '工资',
    '待遇',
    '福利',
    '加班'
  ].filter((part): part is string => Boolean(part?.trim()));
  const sentences = normalized.split(/[。！？!?；;\n\r]+/).map((part) => part.trim()).filter(Boolean);
  const relevant = sentences.filter((sentence) => markers.some((marker) => includesNormalized(sentence, marker))).slice(0, 8);
  const summary = (relevant.length > 0 ? relevant : sentences.slice(0, 4)).join('。');
  return summary.slice(0, 1800);
}

function inferConfidence(summary: string, sourceUrl?: string): CompanyResearchRecord['confidence'] {
  const normalizedSummary = normalizeText(summary);
  if (normalizedSummary.length > 30 && /https?:\/\//i.test(sourceUrl ?? '')) return 'high';
  if (normalizedSummary.length > 60) return 'medium';
  return 'low';
}

function confidenceBase(confidence: CompanyResearchRecord['confidence']): number {
  if (confidence === 'high') return 20;
  if (confidence === 'medium') return 12;
  return 6;
}

function compareResearchRecords(a: CompanyResearchRecord, b: CompanyResearchRecord): number {
  const confidenceDelta = confidenceBase(b.confidence) - confidenceBase(a.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;

  const capturedDelta = Date.parse(b.capturedAt) - Date.parse(a.capturedAt);
  if (Number.isFinite(capturedDelta) && capturedDelta !== 0) return capturedDelta;

  return a.id.localeCompare(b.id);
}

function splitSignal(value: string | undefined): string[] {
  return value?.split(/[、,，;；\s]+/).filter(Boolean) ?? [];
}

function uniqueValues(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const trimmedValue = value?.trim();
    if (!trimmedValue) continue;
    const normalizedValue = normalizeText(trimmedValue);
    if (seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    results.push(trimmedValue);
  }

  return results;
}

function formatSalary(salary: MoneyRange | undefined): string | undefined {
  if (!salary) return undefined;
  return salary.raw ?? `${salary.min ?? '?'}-${salary.max ?? '?'}`;
}

function parseSalary(value: string): MoneyRange | undefined {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)k?(?:-|~|至)(\d+(?:\.\d+)?)k/);
  if (!match) return undefined;

  return {
    min: Number(match[1]) * 1000,
    max: Number(match[2]) * 1000,
    currency: normalized.includes('$') ? 'USD' : 'CNY',
    period: normalized.includes('年') ? 'year' : 'month',
    raw: match[0]
  };
}

import type {
  BlacklistRule,
  CompanyResearchRecord,
  JobPosting,
  JobScore,
  ResumeProfile,
  ScoreGrade,
  ScoreReason,
  ScoreWeights
} from './types';
import { clampScore, includesNormalized, normalizeText } from './text';
import { scoreResearchSignal } from './research';
import { defaultScoreWeights } from './types';

export interface ScoreOptions {
  weights?: Partial<ScoreWeights>;
  blacklist?: BlacklistRule[];
  research?: CompanyResearchRecord[];
  applyThreshold?: number;
  reviewThreshold?: number;
}

export function scoreJob(job: JobPosting, resume: ResumeProfile, options: ScoreOptions = {}): JobScore {
  const weights: ScoreWeights = { ...defaultScoreWeights, ...options.weights };
  const reasons: ScoreReason[] = [];
  const triggeredBlacklistRules = getTriggeredBlacklistRules(job, options.blacklist ?? []);

  if (triggeredBlacklistRules.length > 0) {
    reasons.push({
      key: 'blacklist',
      label: '黑名单命中',
      delta: weights.blacklist,
      detail: triggeredBlacklistRules.map((rule) => rule.reason ?? `${rule.kind}:${rule.value}`).join('; ')
    });
  }

  const titleScore = bestContainsScore(job.title, resume.targetTitles) * weights.title;
  if (titleScore > 0) {
    reasons.push({
      key: 'title',
      label: '岗位标题匹配',
      delta: titleScore,
      detail: `标题“${job.title}”匹配目标岗位`
    });
  }

  const matchedSkills = resume.skills.filter((skill) => includesNormalized(`${job.title} ${job.description} ${job.requirements.join(' ')}`, skill));
  const skillRatio = resume.skills.length === 0 ? 0 : matchedSkills.length / resume.skills.length;
  const skillScore = skillRatio * weights.skills;
  if (skillScore > 0) {
    reasons.push({
      key: 'skills',
      label: '技能匹配',
      delta: skillScore,
      detail: matchedSkills.join(', ')
    });
  }

  const locationScore = bestContainsScore(job.location ?? job.company.location, resume.targetLocations) * weights.location;
  if (locationScore > 0) {
    reasons.push({
      key: 'location',
      label: '城市匹配',
      delta: locationScore,
      detail: job.location ?? job.company.location ?? '未知地点'
    });
  }

  const industryScore = bestContainsScore(`${job.company.industry ?? ''} ${job.tags.join(' ')}`, resume.industries) * weights.industry;
  if (industryScore > 0) {
    reasons.push({
      key: 'industry',
      label: '行业匹配',
      delta: industryScore,
      detail: job.company.industry ?? resume.industries.join(', ')
    });
  }

  const salaryScore = job.salary?.min || job.salary?.max ? weights.salary : 0;
  if (salaryScore > 0) {
    reasons.push({
      key: 'salary',
      label: '薪资信息完整',
      delta: salaryScore,
      detail: job.salary?.raw ?? `${job.salary?.min ?? '?'}-${job.salary?.max ?? '?'}`
    });
  }

  const searchableText = `${job.title} ${job.description} ${job.requirements.join(' ')} ${job.tags.join(' ')} ${job.company.tags.join(' ')}`;
  const bonusScore = scoreAnyKeyword(searchableText, BONUS_KEYWORDS) * weights.bonus;
  if (bonusScore > 0) {
    reasons.push({
      key: 'bonus',
      label: '奖金/绩效',
      delta: bonusScore,
      detail: '岗位或公司信息提到奖金、绩效、年终奖或期权。'
    });
  }

  const benefitsScore = scoreBenefits(searchableText) * weights.benefits;
  if (benefitsScore > 0) {
    reasons.push({
      key: 'benefits',
      label: '福利',
      delta: benefitsScore,
      detail: matchedKeywords(searchableText, BENEFIT_KEYWORDS).join('、')
    });
  }

  const restSignal = scoreRestSignal(searchableText);
  const restScore = restSignal.multiplier * weights.rest;
  if (restScore !== 0) {
    reasons.push({
      key: 'rest',
      label: '休息制度',
      delta: restScore,
      detail: restSignal.detail
    });
  }

  const annualLeaveScore = scoreAnyKeyword(searchableText, ANNUAL_LEAVE_KEYWORDS) * weights.annualLeave;
  if (annualLeaveScore > 0) {
    reasons.push({
      key: 'annualLeave',
      label: '年假',
      delta: annualLeaveScore,
      detail: matchedKeywords(searchableText, ANNUAL_LEAVE_KEYWORDS).join('、')
    });
  }

  const companyScore = job.company.tags.length > 0 || job.company.stage || job.company.size ? weights.company : 0;
  if (companyScore > 0) {
    reasons.push({
      key: 'company',
      label: '公司信息完整',
      delta: companyScore,
      detail: [job.company.stage, job.company.size, ...job.company.tags].filter(Boolean).join(', ')
    });
  }

  const researchSignal = scoreResearchSignal(job, options.research ?? []);
  if (researchSignal) {
    const researchScore = (researchSignal.score / 100) * weights.research;
    reasons.push({
      key: 'research',
      label: '全网资料',
      delta: researchScore,
      detail: researchSignal.reasons.join('；') || researchSignal.record.sourceTitle || '已保存公司研究记录'
    });
  }

  const rawScore = reasons.reduce((sum, reason) => sum + reason.delta, 0);
  const score = clampScore(rawScore);
  const groupedScores = getGroupedScores(reasons, weights);
  const applyThreshold = options.applyThreshold ?? 72;
  const reviewThreshold = options.reviewThreshold ?? 45;
  const recommendation = score >= applyThreshold ? 'apply' : score >= reviewThreshold ? 'review' : 'skip';

  return {
    jobId: job.id,
    score,
    ...groupedScores,
    companyGrade: toGrade(groupedScores.companyScore),
    jobGrade: toGrade(score),
    recommendation: triggeredBlacklistRules.length > 0 ? 'skip' : recommendation,
    reasons,
    matchedSkills,
    triggeredBlacklistRules
  };
}

function getGroupedScores(reasons: ScoreReason[], weights: ScoreWeights): Pick<JobScore, 'companyScore' | 'jobFitScore' | 'compensationScore' | 'workLifeScore'> {
  const rawByKeys = (keys: string[]) => reasons.filter((reason) => keys.includes(reason.key)).reduce((sum, reason) => sum + reason.delta, 0);
  const normalized = (raw: number, max: number) => clampScore(max <= 0 ? 0 : (raw / max) * 100);
  const jobFitRaw = rawByKeys(['title', 'skills', 'location']);
  const compensationRaw = rawByKeys(['salary', 'bonus', 'benefits']);
  const workLifeRaw = rawByKeys(['rest', 'annualLeave']);
  const companyRaw = rawByKeys(['industry', 'salary', 'bonus', 'benefits', 'rest', 'annualLeave', 'company', 'research']);

  return {
    companyScore: normalized(companyRaw, weights.industry + weights.salary + weights.bonus + weights.benefits + weights.rest + weights.annualLeave + weights.company + weights.research),
    jobFitScore: normalized(jobFitRaw, weights.title + weights.skills + weights.location),
    compensationScore: normalized(compensationRaw, weights.salary + weights.bonus + weights.benefits),
    workLifeScore: normalized(workLifeRaw, weights.rest + weights.annualLeave)
  };
}

function toGrade(score: number | undefined): ScoreGrade {
  const value = score ?? 0;
  if (value >= 85) return 'S';
  if (value >= 72) return 'A';
  if (value >= 55) return 'B';
  if (value >= 40) return 'C';
  return 'D';
}

function bestContainsScore(value: string | undefined, targets: string[]): number {
  if (targets.length === 0) return 0;
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return 0;
  return targets.some((target) => normalizedValue.includes(normalizeText(target))) ? 1 : 0;
}

const BONUS_KEYWORDS = ['年终奖', '十三薪', '14薪', '15薪', '16薪', '绩效奖金', '项目奖金', '股票期权', '期权', 'bonus'];
const BENEFIT_KEYWORDS = ['五险一金', '六险一金', '补充医疗', '餐补', '房补', '交通补贴', '定期体检', '节日福利', '带薪病假', '培训预算'];
const ANNUAL_LEAVE_KEYWORDS = ['年假', '带薪年假', '额外假期', '调休'];
const GOOD_REST_KEYWORDS = ['双休', '周末双休', '不加班', '弹性工作', '965', '955', '远程'];
const BAD_REST_KEYWORDS = ['单休', '大小周', '996', '007', '加班严重'];

function scoreAnyKeyword(value: string, keywords: string[]): number {
  return matchedKeywords(value, keywords).length > 0 ? 1 : 0;
}

function scoreBenefits(value: string): number {
  const matches = matchedKeywords(value, BENEFIT_KEYWORDS).length;
  if (matches >= 3) return 1;
  if (matches === 2) return 0.8;
  if (matches === 1) return 0.5;
  return 0;
}

function matchedKeywords(value: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => includesNormalized(value, keyword));
}

function scoreRestSignal(value: string): { multiplier: number; detail: string } {
  const badMatches = matchedKeywords(value, BAD_REST_KEYWORDS);
  if (badMatches.length > 0) {
    return { multiplier: -1, detail: `命中负面休息信号：${badMatches.join('、')}` };
  }

  const goodMatches = matchedKeywords(value, GOOD_REST_KEYWORDS);
  if (goodMatches.length > 0) {
    return { multiplier: 1, detail: `命中正面休息信号：${goodMatches.join('、')}` };
  }

  return { multiplier: 0, detail: '未识别到休息制度信息。' };
}

export function getTriggeredBlacklistRules(job: JobPosting, rules: BlacklistRule[]): BlacklistRule[] {
  return rules.filter((rule) => {
    if (!rule.enabled) return false;

    switch (rule.kind) {
      case 'company':
        return includesNormalized(job.company.name, rule.value);
      case 'keyword':
        return includesNormalized(`${job.title} ${job.description} ${job.requirements.join(' ')}`, rule.value);
      case 'location':
        return includesNormalized(`${job.location ?? ''} ${job.company.location ?? ''}`, rule.value);
      case 'platform':
        return includesNormalized(job.platform, rule.value);
    }
  });
}

import { describe, expect, it } from 'vitest';
import type { JobPosting, ResumeProfile } from '../src';
import {
  buildResearchQueries,
  buildResearchQuery,
  createResearchFromPage,
  getResearchCoverageForJob,
  getResearchForJob,
  parseCompanyResearch,
  scoreJob,
  scoreResearchSignal
} from '../src';

const job: JobPosting = {
  id: 'job-1',
  platform: 'boss',
  title: '前端工程师',
  company: { name: '星河科技', tags: [] },
  description: 'React TypeScript',
  requirements: ['React'],
  tags: [],
  scrapedAt: '2026-06-08T00:00:00.000Z'
};

const resume: ResumeProfile = {
  targetTitles: ['前端工程师'],
  targetLocations: [],
  skills: ['React', 'TypeScript'],
  industries: [],
  rawText: 'React TypeScript 前端工程师'
};

describe('company research', () => {
  it('builds focused full-web search queries', () => {
    expect(buildResearchQuery('星河科技', '前端工程师')).toContain('星河科技 前端工程师 薪资 奖金 福利 双休 年假 加班 评价');
  });

  it('builds criterion-specific full-web search queries', () => {
    const queries = buildResearchQueries('星河科技', '前端工程师', ['salary', 'rest']);

    expect(queries).toEqual([
      { key: 'salary', label: '薪资', query: '星河科技 前端工程师 薪资 工资 待遇' },
      { key: 'rest', label: '休息', query: '星河科技 前端工程师 双休 加班 大小周 996' }
    ]);
  });

  it('matches saved research by company and role before auto ranking uses it', () => {
    const frontEndRecord = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/front-end',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，周末双休。'
    });
    const backendRecord = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '后端工程师',
      sourceUrl: 'https://example.com/backend',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '后端工程师薪资 25-35K，五险一金，周末双休。'
    });
    const otherCompanyRecord = parseCompanyResearch({
      companyName: '远山科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/other',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 20-30K，五险一金。'
    });

    expect(getResearchForJob(job, [frontEndRecord, backendRecord, otherCompanyRecord])).toEqual([frontEndRecord]);
  });

  it('reports missing research coverage by ranking criterion', () => {
    const record = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/salary',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，周末双休。'
    });

    const coverage = getResearchCoverageForJob(job, [record]);

    expect(coverage.sourceCount).toBe(1);
    expect(coverage.completedCount).toBe(3);
    expect(coverage.missingLabels).toEqual(['奖金', '年假', '风险']);
    expect(coverage.criteria.find((criterion) => criterion.key === 'salary')?.details).toEqual(['25-35k']);
  });

  it('aggregates research coverage across multiple web sources', () => {
    const salaryAndBonus = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/jobs',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，餐补，年终奖。'
    });
    const workLifeAndRisk = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端',
      sourceUrl: 'https://example.com/reviews',
      sourceTitle: '员工评价',
      capturedAt: '2026-06-09T00:00:00.000Z',
      summary: '员工评价提到周末双休，带薪年假，补充医疗，整体加班较少。'
    });

    const coverage = getResearchCoverageForJob(job, [salaryAndBonus, workLifeAndRisk]);

    expect(coverage.complete).toBe(true);
    expect(coverage.completedCount).toBe(6);
    expect(coverage.missingKeys).toEqual([]);
    expect(coverage.criteria.find((criterion) => criterion.key === 'risk')?.details).toEqual(['已保存评价/风险相关资料']);
  });

  it('parses pasted web evidence into ranking signals', () => {
    const record = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/research',
      sourceTitle: '星河科技薪资福利',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，餐补，年终奖，周末双休，带薪年假。多条公开招聘信息和员工分享都提到福利稳定、加班较少。'
    });

    expect(record.salary?.min).toBe(25000);
    expect(record.bonus).toContain('年终奖');
    expect(record.benefits).toEqual(expect.arrayContaining(['五险一金', '餐补']));
    expect(record.restSchedule).toContain('双休');
    expect(record.annualLeave).toContain('年假');
    expect(record.confidence).toBe('high');
  });

  it('adds saved research evidence to job scoring', () => {
    const record = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/research',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，餐补，年终奖，周末双休，带薪年假。多条公开招聘信息和员工分享都提到福利稳定、加班较少。'
    });
    const signal = scoreResearchSignal(job, [record]);
    const score = scoreJob(job, resume, { research: [record] });

    expect(signal?.score).toBeGreaterThan(70);
    expect(score.reasons.map((reason) => reason.key)).toContain('research');
    expect(score.companyScore).toBeGreaterThan(0);
  });

  it('aggregates multiple saved web sources for the same company and role', () => {
    const salaryAndBonus = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/jobs',
      sourceTitle: '招聘薪酬',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '前端工程师薪资 25-35K，五险一金，餐补，年终奖。'
    });
    const workLife = parseCompanyResearch({
      companyName: '星河科技',
      jobTitle: '前端',
      sourceUrl: 'https://example.com/reviews',
      sourceTitle: '员工评价',
      capturedAt: '2026-06-09T00:00:00.000Z',
      summary: '员工评价提到周末双休，带薪年假，补充医疗，定期体检。整体福利稳定。'
    });

    const signal = scoreResearchSignal(job, [salaryAndBonus, workLife]);
    const reasons = signal?.reasons.join('；') ?? '';

    expect(signal?.sourceCount).toBe(2);
    expect(signal?.records).toHaveLength(2);
    expect(signal?.score).toBeGreaterThan(80);
    expect(reasons).toContain('资料来源：2条');
    expect(reasons).toContain('外部薪资');
    expect(reasons).toContain('定期体检');
    expect(reasons).toContain('周末双休');
  });

  it('creates research records from captured page text', () => {
    const record = createResearchFromPage({
      companyName: '星河科技',
      jobTitle: '前端工程师',
      sourceUrl: 'https://example.com/page',
      sourceTitle: '员工评价',
      capturedAt: '2026-06-08T00:00:00.000Z',
      pageText: [
        '导航 首页 无关文本',
        '星河科技 前端工程师 薪资 25-35K，年终奖，五险一金，周末双休，带薪年假。',
        '其他岗位内容。'
      ].join('。')
    });

    expect(record.sourceTitle).toBe('员工评价');
    expect(record.summary).toContain('25-35K');
    expect(record.salary?.max).toBe(35000);
    expect(record.confidence).toBe('high');
  });

  it('penalizes negative external evidence', () => {
    const record = parseCompanyResearch({
      companyName: '星河科技',
      sourceUrl: 'https://example.com/research',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '网友反馈存在拖欠工资、强制加班、大小周和 996，福利不透明。'
    });
    const signal = scoreResearchSignal(job, [record]);

    expect(signal?.score).toBeLessThan(0);
    expect(signal?.reasons.join('；')).toContain('风险');
  });

  it('penalizes negative sources even when other saved sources are positive', () => {
    const positiveRecord = parseCompanyResearch({
      companyName: '星河科技',
      sourceUrl: 'https://example.com/jobs',
      capturedAt: '2026-06-08T00:00:00.000Z',
      summary: '公开信息显示薪资 25-35K，五险一金，餐补，年终奖，周末双休，带薪年假。'
    });
    const negativeRecord = parseCompanyResearch({
      companyName: '星河科技',
      sourceUrl: 'https://example.com/reviews',
      capturedAt: '2026-06-09T00:00:00.000Z',
      summary: '多位员工反馈存在强制加班、大小周和 996。'
    });

    const positiveSignal = scoreResearchSignal(job, [positiveRecord]);
    const mixedSignal = scoreResearchSignal(job, [positiveRecord, negativeRecord]);
    const reasons = mixedSignal?.reasons.join('；') ?? '';

    expect(mixedSignal?.score).toBeLessThan(positiveSignal?.score ?? 0);
    expect(reasons).toContain('休息负面');
    expect(reasons).toContain('风险');
  });
});

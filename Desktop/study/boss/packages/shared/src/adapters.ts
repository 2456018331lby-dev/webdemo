import type { AdapterExtractionResult, JobPosting, PlatformAdapter } from './types';
import { createSafeApplyAttempt, evaluatePageSafety } from './automation';
import { stableId, uniqueBy } from './text';

const BOSS_SELECTORS = [
  '.job-card-wrapper',
  '.job-card-body',
  '.job-list-box li',
  '[ka^="search_list_"]',
  '[data-jobid]'
];

export const bossAdapter: PlatformAdapter = {
  platform: 'boss',
  status: 'supported',
  hostPatterns: ['zhipin.com', 'www.zhipin.com'],
  canHandle(url) {
    return this.hostPatterns.some((host) => url.hostname.endsWith(host));
  },
  extractJobs(document, nowIso) {
    const candidates = BOSS_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
    const jobs = uniqueBy(candidates.map((element) => extractBossJob(element, nowIso)).filter(isJobPosting), (job) => job.id);

    return {
      platform: 'boss',
      status: 'supported',
      jobs,
      warnings: jobs.length === 0 ? ['未识别到 BOSS 直聘岗位卡片，可能需要更新 DOM 选择器。'] : []
    };
  },
  prepareApplication(job, mode) {
    if (mode === 'auto') {
      return {
        ok: false,
        mode,
        jobId: job.id,
        pauseReason: 'manual-review-required',
        message: '自动投递需要在内容脚本中完成真实页面检查和点击。'
      };
    }
    const safety = evaluatePageSafety({ url: job.url ?? '', title: job.title, bodyText: job.description });
    return createSafeApplyAttempt(job, mode, safety);
  }
};

function isJobPosting(job: JobPosting | null): job is JobPosting {
  return job !== null;
}

function extractBossJob(element: HTMLElement, nowIso: string): JobPosting | null {
  const title = textFrom(element, ['.job-name', '.job-title', '[title]', 'a']) || element.getAttribute('title') || '';
  const companyName = textFrom(element, ['.company-name', '.company-text', '.boss-name']) || '未知公司';
  const salaryRaw = textFrom(element, ['.salary', '.job-salary', '.red']);
  const location = textFrom(element, ['.job-area', '.job-location', '.info-public']);
  const description = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  if (!title || description.length < 6) return null;

  const href = element.querySelector<HTMLAnchorElement>('a[href]')?.href;
  const tags = Array.from(element.querySelectorAll<HTMLElement>('.tag-list span, .job-tags span, .tag')).map((node) => node.textContent?.trim() ?? '').filter(Boolean);

  return {
    id: element.dataset.jobid || stableId(['boss', title, companyName, salaryRaw, location]),
    platform: 'boss',
    title,
    company: {
      name: companyName,
      location,
      tags,
    },
    location,
    salary: salaryRaw ? parseSalary(salaryRaw) : undefined,
    description,
    requirements: tags,
    tags,
    url: href,
    recruiter: textFrom(element, ['.boss-name', '.recruiter-name']),
    scrapedAt: nowIso
  };
}

function textFrom(element: HTMLElement, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const target = element.querySelector<HTMLElement>(selector);
    const value = target?.textContent?.replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return undefined;
}

function parseSalary(raw: string): JobPosting['salary'] {
  const normalized = raw.replace(/\s+/g, '').toLowerCase();
  const matches = normalized.match(/(\d+(?:\.\d+)?)\s*k?(?:-|~|至)?(\d+(?:\.\d+)?)?\s*k?/i);
  const min = matches?.[1] ? Number(matches[1]) * 1000 : undefined;
  const max = matches?.[2] ? Number(matches[2]) * 1000 : min;

  return {
    min,
    max,
    currency: 'CNY',
    period: normalized.includes('年') ? 'year' : 'month',
    raw
  };
}

export function createStubAdapter(platform: 'lagou' | 'liepin' | 'linkedin', hostPatterns: string[]): PlatformAdapter {
  return {
    platform,
    status: 'stub',
    hostPatterns,
    canHandle(url) {
      return this.hostPatterns.some((host) => url.hostname.endsWith(host));
    },
    extractJobs(): AdapterExtractionResult {
      return {
        platform,
        status: 'stub',
        jobs: [],
        warnings: [`${platform} 适配器已占位，尚未启用 DOM 提取。`]
      };
    },
    prepareApplication(job, mode) {
      return {
        ok: false,
        mode,
        jobId: job.id,
        pauseReason: 'unknown-dom',
        message: `${platform} 尚未支持自动投递。`
      };
    }
  };
}

export const lagouAdapter = createStubAdapter('lagou', ['lagou.com', 'www.lagou.com']);
export const liepinAdapter = createStubAdapter('liepin', ['liepin.com', 'www.liepin.com']);
export const linkedinAdapter = createStubAdapter('linkedin', ['linkedin.com', 'www.linkedin.com']);

export const platformAdapters: PlatformAdapter[] = [bossAdapter, lagouAdapter, liepinAdapter, linkedinAdapter];

export function getAdapterForUrl(url: URL): PlatformAdapter | undefined {
  return platformAdapters.find((adapter) => adapter.canHandle(url));
}

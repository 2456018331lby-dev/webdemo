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

interface DomAdapterConfig {
  platform: 'lagou' | 'liepin' | 'linkedin';
  status: PlatformAdapter['status'];
  hostPatterns: string[];
  cardSelectors: string[];
  titleSelectors: string[];
  companySelectors: string[];
  salarySelectors: string[];
  locationSelectors: string[];
  recruiterSelectors?: string[];
  tagSelectors: string[];
}

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
    currency: normalized.includes('$') || normalized.includes('usd') ? 'USD' : normalized.includes('€') || normalized.includes('eur') ? 'EUR' : 'CNY',
    period: normalized.includes('年') || normalized.includes('year') || normalized.includes('/yr') ? 'year' : 'month',
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

function createDomAdapter(config: DomAdapterConfig): PlatformAdapter {
  return {
    platform: config.platform,
    status: config.status,
    hostPatterns: config.hostPatterns,
    canHandle(url) {
      return this.hostPatterns.some((host) => url.hostname.endsWith(host));
    },
    extractJobs(document, nowIso): AdapterExtractionResult {
      const candidates = config.cardSelectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
      const jobs = uniqueBy(
        candidates.map((element) => extractConfiguredJob(element, config, nowIso)).filter(isJobPosting),
        (job) => job.id
      );

      return {
        platform: config.platform,
        status: config.status,
        jobs,
        warnings: jobs.length === 0 ? [`未识别到 ${config.platform} 岗位卡片，可能需要更新 DOM 选择器。`] : []
      };
    },
    prepareApplication(job, mode) {
      if (mode === 'auto') {
        return {
          ok: false,
          mode,
          jobId: job.id,
          pauseReason: 'manual-review-required',
          message: `${config.platform} 自动投递需要在内容脚本中完成真实页面检查和点击。`
        };
      }

      const safety = evaluatePageSafety({ url: job.url ?? '', title: job.title, bodyText: job.description });
      return createSafeApplyAttempt(job, mode, safety);
    }
  };
}

function extractConfiguredJob(element: HTMLElement, config: DomAdapterConfig, nowIso: string): JobPosting | null {
  const title = textFrom(element, config.titleSelectors) || element.getAttribute('title') || '';
  const companyName = textFrom(element, config.companySelectors) || '未知公司';
  const salaryRaw = textFrom(element, config.salarySelectors);
  const location = textFrom(element, config.locationSelectors);
  const recruiter = config.recruiterSelectors ? textFrom(element, config.recruiterSelectors) : undefined;
  const description = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  if (!title || description.length < 6) return null;

  const href = element.querySelector<HTMLAnchorElement>('a[href]')?.href;
  const tags = Array.from(element.querySelectorAll<HTMLElement>(config.tagSelectors.join(',')))
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean);

  return {
    id: getElementId(element) || stableId([config.platform, title, companyName, salaryRaw, location]),
    platform: config.platform,
    title,
    company: {
      name: companyName,
      location,
      tags
    },
    location,
    salary: salaryRaw ? parseSalary(salaryRaw) : undefined,
    description,
    requirements: tags,
    tags,
    url: href,
    recruiter,
    scrapedAt: nowIso
  };
}

function getElementId(element: HTMLElement): string | undefined {
  return element.dataset.jobid
    || element.dataset.jobId
    || element.dataset.positionid
    || element.dataset.positionId
    || element.dataset.id
    || element.getAttribute('data-job-id')
    || element.getAttribute('data-positionid')
    || element.getAttribute('data-position-id')
    || undefined;
}

export const lagouAdapter = createDomAdapter({
  platform: 'lagou',
  status: 'supported',
  hostPatterns: ['lagou.com', 'www.lagou.com'],
  cardSelectors: ['.con_list_item', '.item__10RTO', '.position-card', '.job-card', '[data-positionid]', '[data-position-id]'],
  titleSelectors: ['.position-name', '.p_top h3', '.job-name', '.position__3qr0X', '[title]', 'a'],
  companySelectors: ['.company-name', '.company_name', '.company__2EsC8', '.company', '.company_info'],
  salarySelectors: ['.money', '.salary', '.job-salary', '.p_bot .money'],
  locationSelectors: ['.add', '.city', '.job-area', '.job-location', '.position__21iOS'],
  recruiterSelectors: ['.publisher', '.recruiter-name'],
  tagSelectors: ['.li_b_l span', '.labels span', '.tag-list span', '.job-tags span', '.tag']
});

export const liepinAdapter = createDomAdapter({
  platform: 'liepin',
  status: 'supported',
  hostPatterns: ['liepin.com', 'www.liepin.com'],
  cardSelectors: ['.job-card-pc-container', '.job-card', '.sojob-item-main', '.job-list-box li', '[data-job-id]'],
  titleSelectors: ['.job-title', '.job-title-box a', '.ellipsis-1', '[title]', 'a'],
  companySelectors: ['.company-name', '.company-info .name', '.company', '.name.ellipsis-1'],
  salarySelectors: ['.salary', '.job-salary', '.job-salary-box'],
  locationSelectors: ['.job-dq-box', '.area', '.job-area', '.job-location'],
  recruiterSelectors: ['.recruiter-name', '.recruiter'],
  tagSelectors: ['.tag-list span', '.labels span', '.job-labels span', '.tag']
});

export const linkedinAdapter = createDomAdapter({
  platform: 'linkedin',
  status: 'supported',
  hostPatterns: ['linkedin.com', 'www.linkedin.com'],
  cardSelectors: ['.jobs-search-results__list-item', '.job-card-container', '.jobs-search-result-item', '.base-card', '[data-job-id]'],
  titleSelectors: ['.job-card-list__title', '.job-card-container__link', '.base-search-card__title', '[aria-label]', 'a'],
  companySelectors: ['.job-card-container__primary-description', '.base-search-card__subtitle', '.company-name', '.job-card-container__company-name'],
  salarySelectors: ['.job-card-container__metadata-item--salary', '.salary', '.job-salary'],
  locationSelectors: ['.job-card-container__metadata-item', '.job-search-card__location', '.base-search-card__metadata', '.job-card-container__metadata-wrapper'],
  recruiterSelectors: ['.recruiter-name'],
  tagSelectors: ['.job-card-container__metadata-item', '.job-card-list__footer-wrapper span', '.tag']
});

export const platformAdapters: PlatformAdapter[] = [bossAdapter, lagouAdapter, liepinAdapter, linkedinAdapter];

export function getAdapterForUrl(url: URL): PlatformAdapter | undefined {
  return platformAdapters.find((adapter) => adapter.canHandle(url));
}

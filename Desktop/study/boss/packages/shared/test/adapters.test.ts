import { describe, expect, it } from 'vitest';
import { bossAdapter, getAdapterForUrl, lagouAdapter, liepinAdapter, linkedinAdapter } from '../src';

describe('platform adapters', () => {
  it('selects the BOSS adapter by host', () => {
    expect(getAdapterForUrl(new URL('https://www.zhipin.com/web/geek/job'))?.platform).toBe('boss');
  });

  it('extracts BOSS job cards from the document', () => {
    const document = makeBossDocument();

    const result = bossAdapter.extractJobs(document, '2026-06-08T00:00:00.000Z');

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      id: 'abc',
      platform: 'boss',
      title: '前端工程师',
      company: { name: '星河科技' },
      location: '北京'
    });
    expect(result.jobs[0]?.salary?.min).toBe(20000);
  });

  it('extracts Lagou job cards from the document', () => {
    const document = makeCardDocument('.con_list_item', {
      dataset: { positionid: 'lg-1' },
      nodes: {
        '.position-name': { textContent: '全栈工程师' },
        '.company-name': { textContent: '拉勾科技' },
        '.money': { textContent: '30-45K' },
        '.add': { textContent: '上海' },
        'a[href]': { href: 'https://www.lagou.com/jobs/lg-1.html', textContent: '全栈工程师' }
      },
      tags: [{ textContent: 'Node' }, { textContent: 'React' }]
    });

    const result = lagouAdapter.extractJobs(document, '2026-06-08T00:00:00.000Z');

    expect(result.status).toBe('supported');
    expect(result.jobs[0]).toMatchObject({
      id: 'lg-1',
      platform: 'lagou',
      title: '全栈工程师',
      company: { name: '拉勾科技' },
      location: '上海'
    });
    expect(result.jobs[0]?.salary?.max).toBe(45000);
  });

  it('extracts Liepin job cards from the document', () => {
    const document = makeCardDocument('.job-card-pc-container', {
      attributes: { 'data-job-id': 'lp-1' },
      nodes: {
        '.job-title': { textContent: 'AI应用开发工程师' },
        '.company-name': { textContent: '猎聘智能' },
        '.salary': { textContent: '40-60K' },
        '.job-dq-box': { textContent: '深圳' },
        'a[href]': { href: 'https://www.liepin.com/job/lp-1.shtml', textContent: 'AI应用开发工程师' }
      },
      tags: [{ textContent: 'Python' }, { textContent: 'LLM' }]
    });

    const result = liepinAdapter.extractJobs(document, '2026-06-08T00:00:00.000Z');

    expect(result.jobs[0]).toMatchObject({
      id: 'lp-1',
      platform: 'liepin',
      title: 'AI应用开发工程师',
      company: { name: '猎聘智能' },
      location: '深圳'
    });
    expect(result.jobs[0]?.tags).toEqual(['Python', 'LLM']);
  });

  it('extracts LinkedIn job cards from the document', () => {
    const document = makeCardDocument('.jobs-search-results__list-item', {
      attributes: { 'data-job-id': 'li-1' },
      nodes: {
        '.job-card-list__title': { textContent: 'Frontend Engineer' },
        '.job-card-container__primary-description': { textContent: 'LinkedIn Labs' },
        '.job-card-container__metadata-item--salary': { textContent: '$120K-$150K /yr' },
        '.job-card-container__metadata-item': { textContent: 'Remote' },
        'a[href]': { href: 'https://www.linkedin.com/jobs/view/li-1', textContent: 'Frontend Engineer' }
      },
      tags: [{ textContent: 'Remote' }]
    });

    const result = linkedinAdapter.extractJobs(document, '2026-06-08T00:00:00.000Z');

    expect(result.jobs[0]).toMatchObject({
      id: 'li-1',
      platform: 'linkedin',
      title: 'Frontend Engineer',
      company: { name: 'LinkedIn Labs' },
      location: 'Remote'
    });
    expect(result.jobs[0]?.salary?.currency).toBe('USD');
    expect(result.jobs[0]?.salary?.period).toBe('year');
  });
});

function makeBossDocument(): Document {
  const nodes: Record<string, unknown> = {
    '.job-name': { textContent: '前端工程师' },
    '.company-name': { textContent: '星河科技' },
    '.salary': { textContent: '20-30K' },
    '.job-area': { textContent: '北京' },
    '.boss-name': { textContent: '王女士' },
    'a[href]': { href: 'https://www.zhipin.com/job_detail/abc.html', textContent: '前端工程师' }
  };
  const tags = [{ textContent: 'React' }, { textContent: 'TypeScript' }];
  const card = {
    dataset: { jobid: 'abc' },
    textContent: '前端工程师 星河科技 20-30K 北京 React TypeScript 王女士',
    getAttribute: () => undefined,
    querySelector: (selector: string) => nodes[selector] ?? undefined,
    querySelectorAll: (selector: string) => selector.includes('.tag-list') ? tags : []
  };

  return {
    querySelectorAll: (selector: string) => selector === '.job-card-wrapper' ? [card] : []
  } as unknown as Document;
}

interface FakeCardInput {
  dataset?: Record<string, string>;
  attributes?: Record<string, string>;
  nodes: Record<string, { textContent?: string; href?: string }>;
  tags?: Array<{ textContent: string }>;
}

function makeCardDocument(cardSelector: string, input: FakeCardInput): Document {
  const card = {
    dataset: input.dataset ?? {},
    textContent: Object.values(input.nodes).map((node) => node.textContent).filter(Boolean).join(' '),
    getAttribute: (name: string) => input.attributes?.[name],
    querySelector: (selector: string) => input.nodes[selector] ?? undefined,
    querySelectorAll: (selector: string) => selector.includes('span') || selector.includes('.tag') ? (input.tags ?? []) : []
  };

  return {
    querySelectorAll: (selector: string) => selector === cardSelector ? [card] : []
  } as unknown as Document;
}

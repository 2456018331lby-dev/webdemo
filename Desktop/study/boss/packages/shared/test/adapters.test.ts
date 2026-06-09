import { describe, expect, it } from 'vitest';
import { bossAdapter, getAdapterForUrl } from '../src';

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

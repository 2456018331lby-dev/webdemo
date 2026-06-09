import { describe, expect, it } from 'vitest';
import type { JobPosting } from '../src';
import { createSafeApplyAttempt, enforceQueuePolicy, evaluatePageSafety } from '../src';

const job: JobPosting = {
  id: 'safe-job',
  platform: 'boss',
  title: '前端工程师',
  company: { name: '安全科技', tags: [] },
  description: 'React TypeScript',
  requirements: ['React'],
  tags: [],
  scrapedAt: '2026-06-08T00:00:00.000Z'
};

describe('automation safety', () => {
  it('pauses on captcha text', () => {
    const decision = evaluatePageSafety({ url: 'https://example.com', title: '安全验证', bodyText: '请完成验证码' });

    expect(decision.safe).toBe(false);
    expect(decision.pauseReason).toBe('captcha-detected');
  });

  it('allows dry-run without real page clicks', () => {
    const decision = evaluatePageSafety({ url: 'https://example.com', title: '岗位详情', bodyText: '立即沟通' });
    const attempt = createSafeApplyAttempt(job, 'dry-run', decision);

    expect(attempt.ok).toBe(true);
    expect(attempt.message).toContain('不会点击投递按钮');
  });

  it('allows one guarded action in auto mode after safety passes', () => {
    const decision = evaluatePageSafety({ url: 'https://example.com', title: '岗位详情', bodyText: '立即沟通' });
    const attempt = createSafeApplyAttempt(job, 'auto', decision);

    expect(attempt.ok).toBe(true);
    expect(attempt.message).toContain('允许执行一次投递动作');
  });

  it('rejects unsafe low interval policy', () => {
    const decision = enforceQueuePolicy({ dailyLimit: 20, maxQueueSize: 100, minMinutesBetweenActions: 1, mode: 'auto' }, 0);

    expect(decision.safe).toBe(false);
    expect(decision.pauseReason).toBe('rate-limit');
  });
});

import type { ApplicationMode, ApplyAttemptResult, JobPosting, PauseReason, QueuePolicy } from './types';

export interface PageSafetySnapshot {
  url: string;
  title: string;
  bodyText: string;
  hasPasswordField?: boolean;
  hasRequiredEmptyFields?: boolean;
}

export interface SafetyDecision {
  safe: boolean;
  pauseReason?: PauseReason;
  message: string;
}

const CAPTCHA_KEYWORDS = ['验证码', 'captcha', '安全验证', '滑块验证', '人机验证'];
const LOGIN_KEYWORDS = ['登录', 'login', 'sign in', '请先登录'];
const PLATFORM_WARNING_KEYWORDS = ['异常访问', '操作频繁', '访问受限', '账号安全', 'risk control'];

export function evaluatePageSafety(snapshot: PageSafetySnapshot): SafetyDecision {
  const text = `${snapshot.title}\n${snapshot.bodyText}`.toLowerCase();

  if (CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    return { safe: false, pauseReason: 'captcha-detected', message: '页面出现验证码或安全验证，已暂停。' };
  }

  if (snapshot.hasPasswordField || LOGIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    return { safe: false, pauseReason: 'login-required', message: '页面需要登录或存在密码输入框，已暂停。' };
  }

  if (PLATFORM_WARNING_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    return { safe: false, pauseReason: 'platform-warning', message: '页面出现平台风险/频率提示，已暂停。' };
  }

  if (snapshot.hasRequiredEmptyFields) {
    return { safe: false, pauseReason: 'missing-required-field', message: '页面存在未填写的必填项，已暂停等待人工处理。' };
  }

  return { safe: true, message: '页面安全检查通过。' };
}

export function createSafeApplyAttempt(job: JobPosting, mode: ApplicationMode, safety: SafetyDecision): ApplyAttemptResult {
  if (!safety.safe) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: safety.pauseReason,
      message: safety.message
    };
  }

  if (mode === 'dry-run') {
    return {
      ok: true,
      mode,
      jobId: job.id,
      message: `dry-run：已记录 ${job.company.name} / ${job.title}，不会点击投递按钮。`
    };
  }

  if (mode === 'manual-approval') {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'manual-review-required',
      message: '人工确认模式：请用户预览后手动确认投递。'
    };
  }

  return {
    ok: true,
    mode,
    jobId: job.id,
    message: '自动模式：页面安全检查通过，允许执行一次投递动作。'
  };
}

export function enforceQueuePolicy(policy: QueuePolicy, applicationsToday: number): SafetyDecision {
  if (applicationsToday >= policy.dailyLimit) {
    return { safe: false, pauseReason: 'rate-limit', message: `达到今日上限 ${policy.dailyLimit}，已暂停。` };
  }

  if (policy.minMinutesBetweenActions < 3) {
    return { safe: false, pauseReason: 'rate-limit', message: '投递间隔低于 3 分钟，风险过高，已暂停。' };
  }

  return { safe: true, message: '队列策略检查通过。' };
}

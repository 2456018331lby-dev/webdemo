import { createSafeApplyAttempt, evaluatePageSafety, getAdapterForUrl } from '@job-assistant/shared';
import type { ApplicationMode, ApplyAttemptResult, JobPosting } from '@job-assistant/shared';
import type { RuntimeMessage } from '../types/messages';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'CONTENT_PREPARE_APPLICATION') {
    prepareApplicationOnPage(message.job, message.mode)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => sendResponse({
        ok: false,
        mode: message.mode,
        jobId: message.job.id,
        pauseReason: 'unknown-dom',
        message: `页面投递动作失败：${error instanceof Error ? error.message : String(error)}`
      } satisfies ApplyAttemptResult));
    return true;
  }

  if (message.type !== 'CONTENT_EXTRACT_JOBS') return false;

  const adapter = getAdapterForUrl(new URL(window.location.href));
  if (!adapter) {
    sendResponse({ ok: false, error: '当前网站暂不支持。' });
    return true;
  }

  const result = adapter.extractJobs(document, new Date().toISOString());
  chrome.runtime.sendMessage({ type: 'CONTENT_EXTRACTION_RESULT', result } satisfies RuntimeMessage);
  sendResponse({ ok: true, result });
  return true;
});

const APPLY_TEXT_KEYWORDS = ['立即沟通', '投递简历', '立即投递', '申请职位', '申请岗位', '我要应聘', '继续沟通', '沟通', 'apply'];
const DISABLED_TEXT_KEYWORDS = ['已投递', '已沟通', '停止招聘', '已下线', '不可投递'];
const SUCCESS_TEXT_KEYWORDS = ['投递成功', '申请成功', '已投递', '已申请', '沟通成功', '已沟通', '简历已发送', '发送成功'];
const MANUAL_CONFIRM_TEXT_KEYWORDS = ['确认投递', '确认发送', '发送简历', '选择简历', '上传简历', '完善简历', '打招呼', '附加信息', '补充信息', '请选择', '确认'];
const HIGHLIGHT_STYLE_ID = 'job-assistant-apply-highlight-style';

async function prepareApplicationOnPage(job: JobPosting, mode: Exclude<ApplicationMode, 'dry-run'>): Promise<ApplyAttemptResult> {
  const safety = evaluatePageSafety(createSafetySnapshot());
  if (!safety.safe) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: safety.pauseReason,
      message: safety.message
    };
  }

  const applyTarget = findApplyTarget();
  if (!applyTarget) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'unknown-dom',
      message: '未找到明确的投递/沟通按钮，已暂停等待人工处理。'
    };
  }

  applyTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  markApplyTarget(applyTarget);

  if (mode === 'manual-approval') {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'manual-review-required',
      message: `已定位投递入口“${visibleText(applyTarget)}”，请人工确认后点击。`
    };
  }

  const attempt = createSafeApplyAttempt(job, mode, safety);
  if (!attempt.ok) return attempt;

  applyTarget.click();
  await waitForPageReaction();
  return classifyPostClickResult(job, mode, visibleText(applyTarget), attempt);
}

function createSafetySnapshot() {
  return {
    url: window.location.href,
    title: document.title,
    bodyText: document.body.innerText.slice(0, 6000),
    hasPasswordField: Boolean(document.querySelector('input[type="password"]')),
    hasRequiredEmptyFields: hasRequiredEmptyFields()
  };
}

function findApplyTarget(): HTMLElement | undefined {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"], .btn, .op-btn, .job-detail-op button, .job-detail-op a'))
    .filter((element) => {
      const text = visibleText(element);
      if (!text) return false;
      if (DISABLED_TEXT_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
      if (element.matches('[disabled], [aria-disabled="true"]')) return false;
      return APPLY_TEXT_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
    });

  return candidates.sort((left, right) => scoreApplyTarget(right) - scoreApplyTarget(left))[0];
}

function classifyPostClickResult(job: JobPosting, mode: Exclude<ApplicationMode, 'dry-run'>, targetText: string, attempt: ApplyAttemptResult): ApplyAttemptResult {
  const safety = evaluatePageSafety(createSafetySnapshot());
  if (!safety.safe) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: safety.pauseReason,
      message: `已点击“${targetText}”，但后续页面触发安全暂停：${safety.message}`
    };
  }

  const bodyText = document.body.innerText.replace(/\s+/g, ' ');
  if (SUCCESS_TEXT_KEYWORDS.some((keyword) => bodyText.includes(keyword))) {
    return {
      ...attempt,
      message: `已点击“${targetText}”，并识别到投递/沟通成功信号。`
    };
  }

  const dialogText = getDialogText();
  const manualReason = dialogText || bodyText;
  if (MANUAL_CONFIRM_TEXT_KEYWORDS.some((keyword) => manualReason.includes(keyword)) || hasRequiredEmptyFields()) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'manual-review-required',
      message: `已点击“${targetText}”，页面需要确认、选择简历或补充信息，请人工处理。`
    };
  }

  return {
    ok: false,
    mode,
    jobId: job.id,
    pauseReason: 'manual-review-required',
    message: `已点击“${targetText}”，但未识别到成功信号，已保留为人工复核。`
  };
}

function getDialogText(): string {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], .dialog, .modal, .boss-dialog, .dialog-wrap, .pop, .popover'))
    .map((element) => visibleText(element))
    .filter(Boolean)
    .join(' ');
}

function hasRequiredEmptyFields(): boolean {
  return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[required], textarea[required], select[required]'))
    .some((field) => !field.value?.trim());
}

function waitForPageReaction(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 1_200);
  });
}

function scoreApplyTarget(element: HTMLElement): number {
  const text = visibleText(element);
  let score = 0;
  if (['立即沟通', '投递简历', '立即投递', '申请职位'].some((keyword) => text.includes(keyword))) score += 20;
  if (element.tagName === 'BUTTON') score += 5;
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) score += 5;
  return score;
}

function markApplyTarget(element: HTMLElement): void {
  if (!document.getElementById(HIGHLIGHT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .job-assistant-apply-target {
        outline: 3px solid #2364d2 !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 6px rgba(35, 100, 210, 0.18) !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('.job-assistant-apply-target').forEach((node) => node.classList.remove('job-assistant-apply-target'));
  element.classList.add('job-assistant-apply-target');
}

function visibleText(element: HTMLElement): string {
  return (element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
}

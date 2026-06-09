import {
  addMinutes,
  appendAuditLog,
  buildResearchQueries,
  buildResearchQuery,
  createSafeApplyAttempt,
  createResearchFromPage,
  enforceQueuePolicy,
  enqueueScoredJobs,
  evaluatePageSafety,
  getMissingResearchQueriesForJob,
  getNextActionableItem,
  getResearchCoverageForJob,
  markQueueItemAttempted,
  reconcileScoredQueue,
  rotateDay,
  scoreJob
} from '@job-assistant/shared';
import type { ApplicationMode, ApplyAttemptResult, BlacklistRule, CompanyResearchRecord, JobPosting, QueuePolicy, QueueState, ResearchQuery, ResumeProfile } from '@job-assistant/shared';
import type { RuntimeMessage, RuntimeResponse } from '../types/messages';
import { loadState, updateState, type ExtensionState } from '../storage/state';

const QUEUE_AUTOMATION_ALARM = 'job-assistant.queue-automation';
const MIN_AUTOMATION_INTERVAL_MINUTES = 3;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== QUEUE_AUTOMATION_ALARM) return;
  void runScheduledQueueAutomation();
});

void ensureQueueAutomationAlarm().catch(() => undefined);

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});

async function handleMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'GET_STATE': {
      const state = await loadState();
      return { ok: true, state };
    }

    case 'SAVE_RESUME': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const jobs = getKnownJobs(current);
        const scoredJobs = scoreJobsForResume(jobs, message.resume, current.blacklist, current.research);
        return {
          ...current,
          resume: message.resume,
          jobs,
          queue: reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy, research: current.research }),
          auditLog: appendAuditLog(current.auditLog, {
            at: nowIso,
            level: 'info',
            action: 'resume.saved',
            message: `简历画像已保存，并按新画像重排 ${scoredJobs.length} 个已识别岗位。`
          })
        };
      });
      return { ok: true, state };
    }

    case 'SET_POLICY': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const jobs = getKnownJobs(current);
        const scoredJobs = current.resume ? scoreJobsForResume(jobs, current.resume, current.blacklist, current.research) : [];
        return {
          ...current,
          policy: message.policy,
          jobs,
          queue: current.resume
            ? reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: message.policy, research: current.research })
            : current.queue,
          auditLog: appendAuditLog(current.auditLog, {
            at: nowIso,
            level: 'info',
            action: 'policy.updated',
            message: `投递策略已更新为 ${message.policy.mode}。`
          })
        };
      });
      if (message.policy.mode !== 'auto' && state.runner.enabled) {
        const stoppedState = await stopQueueAutomation('投递策略已切换为非自动模式，自动队列已停止。', 'warning');
        return { ok: true, state: stoppedState };
      }
      if (message.policy.mode === 'auto' && state.runner.enabled) {
        await scheduleQueueAutomation(state.policy, state.queue);
      }
      return { ok: true, state };
    }

    case 'SET_BLACKLIST': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const jobs = getKnownJobs(current);
        const scoredJobs = current.resume ? scoreJobsForResume(jobs, current.resume, message.blacklist, current.research) : [];
        return {
          ...current,
          blacklist: message.blacklist,
          jobs,
          queue: current.resume
            ? reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy, research: current.research })
            : current.queue,
          auditLog: appendAuditLog(current.auditLog, {
            at: nowIso,
            level: 'info',
            action: 'blacklist.updated',
            message: `黑名单规则已更新：${message.blacklist.length} 条，已重排 ${scoredJobs.length} 个岗位。`
          })
        };
      });
      return { ok: true, state };
    }

    case 'SAVE_RESEARCH': {
      const state = await saveResearchRecord(message.record);
      return { ok: true, state };
    }

    case 'OPEN_RESEARCH_SEARCH': {
      const query = buildResearchQuery(message.companyName, message.jobTitle);
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      await chrome.tabs.create({ url, active: true });
      return { ok: true, message: `已打开资料搜索：${query}` };
    }

    case 'OPEN_RESEARCH_SEARCHES': {
      const queries = buildResearchQueries(message.companyName, message.jobTitle, message.criteria);
      await openResearchQueryTabs(queries);
      return { ok: true, message: `已打开 ${queries.length} 个资料搜索。` };
    }

    case 'CAPTURE_ACTIVE_RESEARCH': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return { ok: false, error: '没有可捕获的活动标签页。' };
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: captureResearchPageText
      });
      const snapshot = injection.result;
      if (!snapshot?.text.trim()) return { ok: false, error: '当前页面没有可保存的文本资料。' };

      const record = createResearchFromPage({
        companyName: message.companyName,
        jobTitle: message.jobTitle,
        sourceUrl: snapshot.url,
        sourceTitle: snapshot.title,
        pageText: snapshot.text,
        capturedAt: new Date().toISOString()
      });
      const state = await saveResearchRecord(record);
      return { ok: true, state, message: `已捕获 ${record.companyName} 的当前页资料。` };
    }

    case 'SCAN_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return { ok: false, error: '没有可扫描的活动标签页。' };
      await chrome.tabs.sendMessage(tab.id, { type: 'CONTENT_EXTRACT_JOBS' } satisfies RuntimeMessage);
      return { ok: true, message: '已请求当前页面扫描岗位。' };
    }

    case 'CONTENT_EXTRACTION_RESULT': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const scoredJobs = current.resume
          ? message.result.jobs.map((job) => ({ job, score: scoreJob(job, current.resume!, { blacklist: current.blacklist, research: current.research }) }))
          : [];

        const nextQueue = current.resume
          ? enqueueScoredJobs(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy })
          : current.queue;

        return {
          ...current,
          jobs: mergeJobs(current.jobs, message.result.jobs),
          queue: nextQueue,
          auditLog: appendAuditLog(current.auditLog, {
            at: nowIso,
            level: message.result.warnings.length > 0 ? 'warning' : 'info',
            action: 'jobs.extracted',
            platform: message.result.platform,
            message: `识别到 ${message.result.jobs.length} 个岗位。${message.result.warnings.join(' ')}`.trim(),
            metadata: { warnings: message.result.warnings, sourceTabId: sender.tab?.id }
          })
        };
      });
      return { ok: true, state };
    }

    case 'QUEUE_JOBS': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        if (!current.resume) return current;
        const scoredJobs = message.jobs.map((job) => ({ job, score: scoreJob(job, current.resume!, { blacklist: current.blacklist, research: current.research }) }));
        return {
          ...current,
          queue: enqueueScoredJobs(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy })
        };
      });
      return { ok: true, state };
    }

    case 'RUN_NEXT_APPLICATION':
    case 'RUN_NEXT_DRY_RUN': {
      const state = await runNextApplicationAction(new Date().toISOString(), 'manual');
      return { ok: true, state };
    }

    case 'START_QUEUE_AUTOMATION': {
      const state = await startQueueAutomation();
      return { ok: true, state };
    }

    case 'STOP_QUEUE_AUTOMATION': {
      const state = await stopQueueAutomation('自动队列已由用户停止。', 'info');
      return { ok: true, state };
    }

    default:
      return { ok: false, error: '未知消息类型。' };
  }
}

async function runNextApplicationAction(nowIso: string, source: 'manual' | 'automation'): Promise<ExtensionState> {
  return updateState(async (current) => {
    const queue = rotateDay(current.queue, nowIso);
    const policyDecision = enforceQueuePolicy(current.policy, queue.applicationsToday);
    if (!policyDecision.safe) {
      return {
        ...current,
        queue,
        auditLog: appendAuditLog(current.auditLog, {
          at: nowIso,
          level: 'warning',
          action: 'queue.paused',
          message: policyDecision.message,
          metadata: { pauseReason: policyDecision.pauseReason, source }
        })
      };
    }

    const runnable = getNextActionableItem(queue, current.policy, nowIso);
    if (!runnable) {
      return {
        ...current,
        queue,
        auditLog: appendAuditLog(current.auditLog, {
          at: nowIso,
          level: 'info',
          action: 'queue.idle',
          message: '当前没有可执行的投递任务。',
          metadata: { source }
        })
      };
    }

    if (shouldPauseForMissingResearch(runnable.job, current.policy, current.research)) {
      const coverage = getResearchCoverageForJob(runnable.job, current.research);
      const queries = getMissingResearchQueriesForJob(runnable.job, current.research);
      const openedSearches = await openResearchQueryTabs(queries);
      const attempt: ApplyAttemptResult = {
        ok: false,
        mode: current.policy.mode,
        jobId: runnable.job.id,
        pauseReason: 'missing-research',
        message: `自动模式缺少全网资料（${coverage.missingLabels.join('、')}）：${runnable.job.company.name} / ${runnable.job.title}。已打开 ${openedSearches} 个搜索页。`
      };
      return {
        ...current,
        queue: markQueueItemAttempted(queue, runnable.id, nowIso, current.policy, false, attempt.pauseReason),
        runner: source === 'automation' ? { ...current.runner, lastTickAt: nowIso } : current.runner,
        auditLog: appendAuditLog(current.auditLog, {
          at: nowIso,
          level: 'warning',
          action: 'apply.paused',
          platform: runnable.job.platform,
          jobId: runnable.job.id,
          message: attempt.message,
          metadata: {
            source,
            pauseReason: attempt.pauseReason,
            missingResearch: coverage.missingLabels,
            openedSearches,
            queries: queries.map((query) => query.query)
          }
        })
      };
    }

    const attempt = current.policy.mode === 'dry-run'
      ? createLocalApplyAttempt(runnable.job, current.policy.mode)
      : await prepareApplicationInTab(runnable.job, current.policy.mode);
    return {
      ...current,
      queue: markQueueItemAttempted(queue, runnable.id, nowIso, current.policy, attempt.ok, attempt.pauseReason),
      runner: source === 'automation' ? { ...current.runner, lastTickAt: nowIso } : current.runner,
      auditLog: appendAuditLog(current.auditLog, {
        at: nowIso,
        level: attempt.ok ? 'info' : 'warning',
        action: attempt.ok ? 'apply.recorded' : 'apply.paused',
        platform: runnable.job.platform,
        jobId: runnable.job.id,
        message: attempt.message,
        metadata: { source, pauseReason: attempt.pauseReason }
      })
    };
  });
}

async function startQueueAutomation(): Promise<ExtensionState> {
  const nowIso = new Date().toISOString();
  const state = await updateState((current) => {
    if (current.policy.mode !== 'auto') {
      return {
        ...current,
        runner: {
          ...current.runner,
          enabled: false,
          stoppedAt: nowIso,
          message: '请先把投递策略切换为自动队列。'
        },
        auditLog: appendAuditLog(current.auditLog, {
          at: nowIso,
          level: 'warning',
          action: 'automation.start-blocked',
          message: '请先把投递策略切换为自动队列，再启动定时投递。'
        })
      };
    }

    return {
      ...current,
      runner: {
        ...current.runner,
        enabled: true,
        startedAt: nowIso,
        stoppedAt: undefined,
        message: '自动队列已启动，将按安全间隔逐条执行。'
      },
      auditLog: appendAuditLog(current.auditLog, {
        at: nowIso,
        level: 'info',
        action: 'automation.started',
        message: `自动队列已启动，间隔 ${getAutomationIntervalMinutes(current.policy)} 分钟。`
      })
    };
  });

  if (state.runner.enabled) await scheduleQueueAutomation(state.policy, state.queue);
  else await chrome.alarms.clear(QUEUE_AUTOMATION_ALARM);
  return state;
}

async function stopQueueAutomation(message: string, level: 'info' | 'warning'): Promise<ExtensionState> {
  await chrome.alarms.clear(QUEUE_AUTOMATION_ALARM);
  const nowIso = new Date().toISOString();
  return updateState((current) => ({
    ...current,
    runner: {
      ...current.runner,
      enabled: false,
      stoppedAt: nowIso,
      message
    },
    auditLog: appendAuditLog(current.auditLog, {
      at: nowIso,
      level,
      action: 'automation.stopped',
      message
    })
  }));
}

async function runScheduledQueueAutomation(): Promise<void> {
  const current = await loadState();
  if (!current.runner.enabled) {
    await chrome.alarms.clear(QUEUE_AUTOMATION_ALARM);
    return;
  }

  if (current.policy.mode !== 'auto') {
    await stopQueueAutomation('投递策略不再是自动队列，自动队列已停止。', 'warning');
    return;
  }

  const state = await runNextApplicationAction(new Date().toISOString(), 'automation');
  const latestEntry = state.auditLog[0];
  if (latestEntry?.action === 'apply.recorded') {
    await scheduleQueueAutomation(state.policy, state.queue);
    return;
  }

  await stopQueueAutomation(`自动队列已暂停：${latestEntry?.message ?? '未识别到可执行结果。'}`, latestEntry?.action === 'queue.idle' ? 'info' : 'warning');
}

async function ensureQueueAutomationAlarm(): Promise<void> {
  const state = await loadState();
  if (state.runner.enabled && state.policy.mode === 'auto') {
    await scheduleQueueAutomation(state.policy, state.queue);
    return;
  }
  await chrome.alarms.clear(QUEUE_AUTOMATION_ALARM);
}

async function scheduleQueueAutomation(policy: QueuePolicy, queue: QueueState): Promise<void> {
  const intervalMinutes = getAutomationIntervalMinutes(policy);
  const delayInMinutes = getAutomationDelayMinutes(policy, queue, new Date().toISOString());
  await chrome.alarms.create(QUEUE_AUTOMATION_ALARM, {
    delayInMinutes,
    periodInMinutes: intervalMinutes
  });
}

function getAutomationIntervalMinutes(policy: QueuePolicy): number {
  return Math.max(MIN_AUTOMATION_INTERVAL_MINUTES, policy.minMinutesBetweenActions);
}

function getAutomationDelayMinutes(policy: QueuePolicy, queue: QueueState, nowIso: string): number {
  if (!queue.lastApplicationAt) return 1;
  const nextRunAt = addMinutes(queue.lastApplicationAt, getAutomationIntervalMinutes(policy));
  const delayMs = new Date(nextRunAt).getTime() - new Date(nowIso).getTime();
  return Math.max(1, Math.ceil(delayMs / 60_000));
}

async function prepareApplicationInTab(job: JobPosting, mode: Exclude<ApplicationMode, 'dry-run'>): Promise<ApplyAttemptResult> {
  if (!job.url) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'unknown-dom',
      message: '岗位缺少详情页链接，无法打开页面准备投递。'
    };
  }

  const tab = await chrome.tabs.create({ url: job.url, active: true });
  if (!tab.id) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'unknown-dom',
      message: '无法打开岗位详情页，已暂停。'
    };
  }

  await waitForTabComplete(tab.id);

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: 'CONTENT_PREPARE_APPLICATION',
      job,
      mode
    } satisfies RuntimeMessage) as ApplyAttemptResult;
  } catch (error) {
    return {
      ok: false,
      mode,
      jobId: job.id,
      pauseReason: 'unknown-dom',
      message: `无法连接岗位页面投递脚本：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function waitForTabComplete(tabId: number, timeoutMs = 15_000): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function saveResearchRecord(record: CompanyResearchRecord): Promise<Awaited<ReturnType<typeof loadState>>> {
  const nowIso = new Date().toISOString();
  return updateState((current) => {
    const research = [record, ...current.research.filter((item) => item.id !== record.id)].slice(0, 300);
    const jobs = getKnownJobs(current);
    const scoredJobs = current.resume ? scoreJobsForResume(jobs, current.resume, current.blacklist, research) : [];
    return {
      ...current,
      jobs,
      research,
      queue: current.resume
        ? reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy, research })
        : current.queue,
      auditLog: appendAuditLog(current.auditLog, {
        at: nowIso,
        level: record.warnings.length > 0 ? 'warning' : 'info',
        action: 'research.saved',
        message: `已保存 ${record.companyName} 的全网资料。`,
        metadata: { sourceUrl: record.sourceUrl, warnings: record.warnings }
      })
    };
  });
}

function captureResearchPageText(): { url: string; title: string; text: string } {
  const blockedSelectors = 'script, style, noscript, svg, canvas, iframe, nav, footer, header, aside';
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(blockedSelectors).forEach((node) => node.remove());
  const text = clone.innerText.replace(/\s+/g, ' ').trim().slice(0, 12000);
  return {
    url: window.location.href,
    title: document.title,
    text
  };
}

function getKnownJobs(state: ExtensionState): JobPosting[] {
  return mergeJobs(state.jobs, state.queue.items.map((item) => item.job));
}

function scoreJobsForResume(
  jobs: JobPosting[],
  resume: ResumeProfile,
  blacklist: BlacklistRule[],
  research: CompanyResearchRecord[]
): Array<{ job: JobPosting; score: ReturnType<typeof scoreJob> }> {
  return jobs.map((job) => ({ job, score: scoreJob(job, resume, { blacklist, research }) }));
}

function mergeJobs(existing: JobPosting[], incoming: JobPosting[]): JobPosting[] {
  const map = new Map(existing.map((job) => [`${job.platform}:${job.id}`, job]));
  for (const job of incoming) map.set(`${job.platform}:${job.id}`, job);
  return Array.from(map.values()).slice(-500);
}

function shouldPauseForMissingResearch(job: JobPosting, policy: QueuePolicy, research: CompanyResearchRecord[]): boolean {
  return policy.mode === 'auto' && policy.requireResearchBeforeAuto && !getResearchCoverageForJob(job, research).complete;
}

async function openResearchQueryTabs(queries: ResearchQuery[]): Promise<number> {
  let opened = 0;
  for (const [index, query] of queries.entries()) {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query.query)}`;
    await chrome.tabs.create({ url, active: index === 0 });
    opened += 1;
  }
  return opened;
}

function createLocalApplyAttempt(job: JobPosting, mode: ApplicationMode): ApplyAttemptResult {
  const safety = evaluatePageSafety({
    url: job.url ?? '',
    title: job.title,
    bodyText: `${job.company.name} ${job.company.tags.join(' ')} ${job.description} ${job.requirements.join(' ')} ${job.tags.join(' ')}`
  });

  return createSafeApplyAttempt(job, mode, safety);
}

import {
  addMinutes,
  appendAuditLog,
  buildResearchQueries,
  buildResearchQuery,
  createSafeApplyAttempt,
  createResearchFromPage,
  enforceQueuePolicy,
  evaluatePageSafety,
  getMissingResearchQueriesForJob,
  getNextActionableItem,
  getResearchCoverageForJob,
  markQueueItemAttempted,
  reconcileScoredQueue,
  researchCriteria,
  rotateDay,
  scoreJob
} from '@job-assistant/shared';
import type { ApplicationMode, ApplyAttemptResult, BlacklistRule, CompanyResearchRecord, JobPosting, QueuePolicy, QueueState, ResearchQuery, ResumeProfile } from '@job-assistant/shared';
import type { RuntimeMessage, RuntimeResponse } from '../types/messages';
import { loadState, updateState, type ExtensionState, type PendingResearchTarget } from '../storage/state';

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
      const nowIso = new Date().toISOString();
      const query = buildResearchQuery(message.companyName, message.jobTitle);
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      const state = await updateState((current) => ({
        ...current,
        pendingResearchTargets: upsertPendingResearchTarget(
          current.pendingResearchTargets,
          createPendingResearchTarget({
            companyName: message.companyName,
            jobTitle: message.jobTitle,
            missingKeys: researchCriteria.map((criterion) => criterion.key),
            missingLabels: researchCriteria.map((criterion) => criterion.label),
            queries: [{ key: 'salary', label: '全网资料', query }],
            source: 'manual-search',
            nowIso
          })
        )
      }));
      await chrome.tabs.create({ url, active: true });
      return { ok: true, state, message: `已打开资料搜索：${query}` };
    }

    case 'OPEN_RESEARCH_SEARCHES': {
      const nowIso = new Date().toISOString();
      const queries = buildResearchQueries(message.companyName, message.jobTitle, message.criteria);
      const state = await updateState((current) => ({
        ...current,
        pendingResearchTargets: upsertPendingResearchTarget(
          current.pendingResearchTargets,
          createPendingResearchTarget({
            companyName: message.companyName,
            jobTitle: message.jobTitle,
            jobId: message.jobId,
            platform: message.platform,
            missingKeys: queries.map((query) => query.key),
            missingLabels: queries.map((query) => query.label),
            queries,
            source: 'manual-search',
            nowIso
          })
        )
      }));
      await openResearchQueryTabs(queries);
      return { ok: true, state, message: `已打开 ${queries.length} 个资料搜索。` };
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
      await requestJobExtractionFromTab(tab.id);
      return { ok: true, message: '已请求当前页面扫描岗位。' };
    }

    case 'CONTENT_EXTRACTION_RESULT': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const scoredJobs = current.resume
          ? message.result.jobs.map((job) => ({ job, score: scoreJob(job, current.resume!, { blacklist: current.blacklist, research: current.research }) }))
          : [];

        const nextQueue = current.resume
          ? reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy, research: current.research })
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

    case 'CONTENT_RESEARCH_RESULT': {
      const nowIso = new Date().toISOString();
      const state = await updateState((current) => {
        const target = findPendingResearchTargetForQuery(current.pendingResearchTargets, message.query);
        if (!target) {
          return current;
        }

        const record = createResearchFromPage({
          companyName: target.companyName,
          jobTitle: target.jobTitle,
          sourceUrl: message.sourceUrl,
          sourceTitle: message.sourceTitle,
          pageText: message.pageText,
          capturedAt: nowIso
        });
        return applyResearchRecord(current, record, nowIso, {
          action: 'research.auto-saved',
          message: `已自动采集 ${target.companyName} 的搜索资料并重排队列。`,
          metadata: { query: message.query, sourceUrl: message.sourceUrl, sourceTabId: sender.tab?.id }
        });
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
          queue: reconcileScoredQueue(rotateDay(current.queue, nowIso), scoredJobs, { nowIso, policy: current.policy, research: current.research })
        };
      });
      return { ok: true, state };
    }

    case 'RUN_NEXT_APPLICATION': {
      const state = await runNextApplicationAction(new Date().toISOString(), 'manual');
      return { ok: true, state };
    }

    case 'RUN_NEXT_DRY_RUN': {
      const state = await runNextApplicationAction(new Date().toISOString(), 'manual', 'dry-run');
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

async function runNextApplicationAction(nowIso: string, source: 'manual' | 'automation', modeOverride?: ApplicationMode): Promise<ExtensionState> {
  let researchQueriesToOpen: ResearchQuery[] = [];
  const state = await updateState(async (current) => {
    const queue = rotateDay(current.queue, nowIso);
    const effectivePolicy = modeOverride ? { ...current.policy, mode: modeOverride } : current.policy;
    const policyDecision = enforceQueuePolicy(effectivePolicy, queue.applicationsToday);
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

    const runnable = getNextActionableItem(queue, effectivePolicy, nowIso);
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

    if (shouldPauseForMissingResearch(runnable.job, effectivePolicy, current.research)) {
      const coverage = getResearchCoverageForJob(runnable.job, current.research);
      const queries = getMissingResearchQueriesForJob(runnable.job, current.research);
      researchQueriesToOpen = queries;
      const attempt: ApplyAttemptResult = {
        ok: false,
        mode: effectivePolicy.mode,
        jobId: runnable.job.id,
        pauseReason: 'missing-research',
        message: `自动模式缺少全网资料（${coverage.missingLabels.join('、')}）：${runnable.job.company.name} / ${runnable.job.title}。将打开 ${queries.length} 个搜索页并自动采集结果。`
      };
      return {
        ...current,
        queue: markQueueItemAttempted(queue, runnable.id, nowIso, effectivePolicy, false, attempt.pauseReason),
        runner: source === 'automation' ? { ...current.runner, lastTickAt: nowIso } : current.runner,
        pendingResearchTargets: upsertPendingResearchTarget(
          current.pendingResearchTargets,
          createPendingResearchTarget({
            companyName: runnable.job.company.name,
            jobTitle: runnable.job.title,
            jobId: runnable.job.id,
            platform: runnable.job.platform,
            missingKeys: coverage.missingKeys,
            missingLabels: coverage.missingLabels,
            queries,
            source: 'auto-queue',
            nowIso
          })
        ),
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
            openedSearches: queries.length,
            queries: queries.map((query) => query.query)
          }
        })
      };
    }

    const attempt = effectivePolicy.mode === 'dry-run'
      ? createLocalApplyAttempt(runnable.job, effectivePolicy.mode)
      : await prepareApplicationInTab(runnable.job, effectivePolicy.mode);
    return {
      ...current,
      queue: markQueueItemAttempted(queue, runnable.id, nowIso, effectivePolicy, attempt.ok, attempt.pauseReason),
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

  if (researchQueriesToOpen.length > 0) {
    await openResearchQueryTabs(researchQueriesToOpen);
  }

  return state;
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

  if (latestEntry?.action === 'apply.paused' && latestEntry.metadata?.pauseReason === 'missing-research') {
    await scheduleQueueAutomation(state.policy, state.queue);
    return;
  }

  if (latestEntry?.action === 'queue.idle' && state.pendingResearchTargets.length > 0) {
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
    return await requestApplicationPreparationFromTab(tab.id, job, mode);
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

async function requestApplicationPreparationFromTab(tabId: number, job: JobPosting, mode: Exclude<ApplicationMode, 'dry-run'>): Promise<ApplyAttemptResult> {
  const message = {
    type: 'CONTENT_PREPARE_APPLICATION',
    job,
    mode
  } satisfies RuntimeMessage;

  try {
    return await chrome.tabs.sendMessage(tabId, message) as ApplyAttemptResult;
  } catch {
    await injectContentScript(tabId);
    return await chrome.tabs.sendMessage(tabId, message) as ApplyAttemptResult;
  }
}

async function requestJobExtractionFromTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CONTENT_EXTRACT_JOBS' } satisfies RuntimeMessage);
    return;
  } catch {
    await injectContentScript(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'CONTENT_EXTRACT_JOBS' } satisfies RuntimeMessage);
  }
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/main.js']
  });
}

async function saveResearchRecord(record: CompanyResearchRecord): Promise<Awaited<ReturnType<typeof loadState>>> {
  const nowIso = new Date().toISOString();
  return updateState((current) => applyResearchRecord(current, record, nowIso, {
    action: 'research.saved',
    message: `已保存 ${record.companyName} 的全网资料。`,
    metadata: { sourceUrl: record.sourceUrl, warnings: record.warnings }
  }));
}

function applyResearchRecord(
  current: ExtensionState,
  record: CompanyResearchRecord,
  nowIso: string,
  audit: { action: string; message: string; metadata?: Record<string, unknown> }
): ExtensionState {
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
    pendingResearchTargets: refreshPendingResearchTargets(current.pendingResearchTargets, jobs, research, nowIso),
    auditLog: appendAuditLog(current.auditLog, {
      at: nowIso,
      level: record.warnings.length > 0 ? 'warning' : 'info',
      action: audit.action,
      message: audit.message,
      metadata: { ...audit.metadata, sourceUrl: record.sourceUrl, warnings: record.warnings }
    })
  };
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
  return mergeJobs(state.queue.items.map((item) => item.job), state.jobs);
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

function createPendingResearchTarget(input: {
  companyName: string;
  jobTitle?: string;
  jobId?: string;
  platform?: JobPosting['platform'];
  missingKeys: PendingResearchTarget['missingKeys'];
  missingLabels: string[];
  queries: ResearchQuery[];
  source: PendingResearchTarget['source'];
  nowIso: string;
}): PendingResearchTarget {
  return {
    id: pendingResearchTargetId(input.companyName, input.jobTitle, input.platform, input.jobId),
    companyName: input.companyName.trim(),
    jobTitle: input.jobTitle?.trim() || undefined,
    jobId: input.jobId,
    platform: input.platform,
    missingKeys: input.missingKeys,
    missingLabels: input.missingLabels,
    queries: input.queries.map((query) => query.query),
    source: input.source,
    createdAt: input.nowIso,
    updatedAt: input.nowIso
  };
}

function upsertPendingResearchTarget(targets: PendingResearchTarget[], target: PendingResearchTarget): PendingResearchTarget[] {
  const existing = targets.find((item) => item.id === target.id);
  const next = { ...target, createdAt: existing?.createdAt ?? target.createdAt };
  return [next, ...targets.filter((item) => item.id !== target.id)].slice(0, 30);
}

function findPendingResearchTargetForQuery(targets: PendingResearchTarget[], query: string): PendingResearchTarget | undefined {
  const normalizedQuery = normalizeResearchQuery(query);
  if (!normalizedQuery) return undefined;

  return targets.find((target) => target.queries.some((candidate) => normalizeResearchQuery(candidate) === normalizedQuery))
    ?? targets.find((target) => target.queries.some((candidate) => {
      const normalizedCandidate = normalizeResearchQuery(candidate);
      if (!normalizedCandidate) return false;
      return normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate);
    }))
    ?? targets.find((target) => {
      const companyName = normalizeResearchQuery(target.companyName);
      const jobTitle = normalizeResearchQuery(target.jobTitle ?? '');
      return normalizedQuery.includes(companyName) && (!jobTitle || normalizedQuery.includes(jobTitle));
    });
}

function normalizeResearchQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function refreshPendingResearchTargets(
  targets: PendingResearchTarget[],
  jobs: JobPosting[],
  research: CompanyResearchRecord[],
  nowIso: string
): PendingResearchTarget[] {
  return targets.flatMap((target) => {
    const job = findPendingResearchJob(target, jobs);
    if (!job) return [target];

    const coverage = getResearchCoverageForJob(job, research);
    if (coverage.complete) return [];

    const queries = getMissingResearchQueriesForJob(job, research);
    return [{
      ...target,
      missingKeys: coverage.missingKeys,
      missingLabels: coverage.missingLabels,
      queries: queries.map((query) => query.query),
      updatedAt: nowIso
    }];
  });
}

function findPendingResearchJob(target: PendingResearchTarget, jobs: JobPosting[]): JobPosting | undefined {
  if (target.jobId && target.platform) {
    const directMatch = jobs.find((job) => job.id === target.jobId && job.platform === target.platform);
    if (directMatch) return directMatch;
  }

  return jobs.find((job) => {
    if (job.company.name !== target.companyName) return false;
    if (!target.jobTitle) return true;
    return job.title === target.jobTitle;
  });
}

function pendingResearchTargetId(companyName: string, jobTitle?: string, platform?: JobPosting['platform'], jobId?: string): string {
  if (platform && jobId) return `${platform}:${jobId}`;
  return `${companyName.trim().toLowerCase()}::${jobTitle?.trim().toLowerCase() ?? ''}`;
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

import type {
  AuditLogEntry,
  BlacklistRule,
  CompanyResearchRecord,
  JobPosting,
  QueuePolicy,
  QueueState,
  ResumeProfile
} from '@job-assistant/shared';
import { defaultQueuePolicy } from '@job-assistant/shared';

export interface ExtensionState {
  resume?: ResumeProfile;
  jobs: JobPosting[];
  research: CompanyResearchRecord[];
  queue: QueueState;
  policy: QueuePolicy;
  blacklist: BlacklistRule[];
  auditLog: AuditLogEntry[];
  runner: AutomationRunnerState;
}

export interface AutomationRunnerState {
  enabled: boolean;
  startedAt?: string;
  stoppedAt?: string;
  lastTickAt?: string;
  message?: string;
}

const STORAGE_KEY = 'jobAssistantState';

export function createInitialState(nowIso = new Date().toISOString()): ExtensionState {
  return {
    jobs: [],
    research: [],
    queue: {
      items: [],
      applicationsToday: 0,
      dayKey: nowIso.slice(0, 10)
    },
    policy: defaultQueuePolicy,
    blacklist: [
      { id: 'kw-outsourcing', kind: 'keyword', value: '外包', reason: '默认跳过外包岗位', enabled: true },
      { id: 'kw-single-rest', kind: 'keyword', value: '单休', reason: '默认跳过单休岗位', enabled: true },
      { id: 'kw-training', kind: 'keyword', value: '培训', reason: '默认跳过培训类岗位', enabled: true }
    ],
    auditLog: [],
    runner: { enabled: false }
  };
}

export async function loadState(): Promise<ExtensionState> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = data[STORAGE_KEY] as Partial<ExtensionState> | undefined;
  return stored ? normalizeState(stored) : createInitialState();
}

export async function saveState(state: ExtensionState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function updateState(updater: (state: ExtensionState) => ExtensionState | Promise<ExtensionState>): Promise<ExtensionState> {
  const current = await loadState();
  const next = await updater(current);
  await saveState(next);
  return next;
}

function normalizeState(state: Partial<ExtensionState>): ExtensionState {
  const initial = createInitialState();
  return {
    ...initial,
    ...state,
    jobs: state.jobs ?? initial.jobs,
    research: state.research ?? initial.research,
    queue: state.queue ?? initial.queue,
    policy: { ...initial.policy, ...state.policy },
    blacklist: state.blacklist ?? initial.blacklist,
    auditLog: state.auditLog ?? initial.auditLog,
    runner: {
      enabled: state.runner?.enabled ?? false,
      startedAt: state.runner?.startedAt,
      stoppedAt: state.runner?.stoppedAt,
      lastTickAt: state.runner?.lastTickAt,
      message: state.runner?.message
    }
  };
}

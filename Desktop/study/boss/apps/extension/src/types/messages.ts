import type {
  AdapterExtractionResult,
  ApplicationMode,
  BlacklistRule,
  CompanyResearchRecord,
  JobPosting,
  PageSafetySnapshot,
  PlatformId,
  QueuePolicy,
  ResearchCriterionKey,
  ResumeProfile
} from '@job-assistant/shared';
import type { ExtensionState } from '../storage/state';

export type RuntimeMessage =
  | { type: 'GET_STATE' }
  | { type: 'SAVE_RESUME'; resume: ResumeProfile }
  | { type: 'SET_POLICY'; policy: QueuePolicy }
  | { type: 'SET_BLACKLIST'; blacklist: BlacklistRule[] }
  | { type: 'SAVE_RESEARCH'; record: CompanyResearchRecord }
  | { type: 'OPEN_RESEARCH_SEARCH'; companyName: string; jobTitle?: string }
  | { type: 'OPEN_RESEARCH_SEARCHES'; companyName: string; jobTitle?: string; criteria?: ResearchCriterionKey[]; jobId?: string; platform?: PlatformId }
  | { type: 'CAPTURE_ACTIVE_RESEARCH'; companyName: string; jobTitle?: string }
  | { type: 'SCAN_ACTIVE_TAB' }
  | { type: 'CONTENT_EXTRACT_JOBS' }
  | { type: 'CONTENT_PREPARE_APPLICATION'; job: JobPosting; mode: Exclude<ApplicationMode, 'dry-run'> }
  | { type: 'CONTENT_EXTRACTION_RESULT'; result: AdapterExtractionResult }
  | { type: 'CONTENT_SAFETY_SNAPSHOT'; snapshot: PageSafetySnapshot }
  | { type: 'QUEUE_JOBS'; jobs: JobPosting[] }
  | { type: 'RUN_NEXT_APPLICATION' }
  | { type: 'RUN_NEXT_DRY_RUN' }
  | { type: 'START_QUEUE_AUTOMATION' }
  | { type: 'STOP_QUEUE_AUTOMATION' };

export type RuntimeResponse =
  | { ok: true; state?: ExtensionState; result?: unknown; message?: string }
  | { ok: false; error: string };

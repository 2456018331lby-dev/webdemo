export type PlatformId = 'boss' | 'lagou' | 'liepin' | 'linkedin';

export type ApplicationMode = 'dry-run' | 'manual-approval' | 'auto';

export type JobSourceStatus = 'supported' | 'stub' | 'unsupported';

export interface MoneyRange {
  min?: number;
  max?: number;
  currency: 'CNY' | 'USD' | 'EUR' | 'UNKNOWN';
  period: 'month' | 'year' | 'hour' | 'unknown';
  raw?: string;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  industry?: string;
  stage?: string;
  size?: string;
  location?: string;
  tags: string[];
}

export interface CompanyResearchRecord {
  id: string;
  companyName: string;
  jobTitle?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  capturedAt: string;
  summary: string;
  salary?: MoneyRange;
  bonus?: string;
  benefits: string[];
  restSchedule?: string;
  annualLeave?: string;
  warnings: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface JobPosting {
  id: string;
  platform: PlatformId;
  title: string;
  company: CompanyProfile;
  location?: string;
  salary?: MoneyRange;
  description: string;
  requirements: string[];
  tags: string[];
  url?: string;
  recruiter?: string;
  scrapedAt: string;
}

export interface ResumeProfile {
  name?: string;
  targetTitles: string[];
  targetLocations: string[];
  skills: string[];
  industries: string[];
  yearsOfExperience?: number;
  rawText: string;
}

export interface ScoreWeights {
  title: number;
  skills: number;
  location: number;
  industry: number;
  salary: number;
  bonus: number;
  benefits: number;
  rest: number;
  annualLeave: number;
  research: number;
  company: number;
  blacklist: number;
}

export interface BlacklistRule {
  id: string;
  kind: 'company' | 'keyword' | 'location' | 'platform';
  value: string;
  reason?: string;
  enabled: boolean;
}

export interface ScoreReason {
  key: string;
  label: string;
  delta: number;
  detail: string;
}

export interface JobScore {
  jobId: string;
  score: number;
  companyScore?: number;
  jobFitScore?: number;
  compensationScore?: number;
  workLifeScore?: number;
  companyGrade?: ScoreGrade;
  jobGrade?: ScoreGrade;
  recommendation: 'apply' | 'review' | 'skip';
  reasons: ScoreReason[];
  matchedSkills: string[];
  triggeredBlacklistRules: BlacklistRule[];
}

export type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface QueuePolicy {
  dailyLimit: number;
  minMinutesBetweenActions: number;
  maxQueueSize: number;
  mode: ApplicationMode;
  requireResearchBeforeAuto: boolean;
}

export type QueueItemStatus = 'queued' | 'needs-approval' | 'in-progress' | 'paused' | 'completed' | 'failed' | 'skipped';

export interface QueueItem {
  id: string;
  job: JobPosting;
  score: JobScore;
  status: QueueItemStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextRunAt?: string;
  pauseReason?: PauseReason;
}

export type PauseReason =
  | 'captcha-detected'
  | 'login-required'
  | 'unknown-dom'
  | 'missing-required-field'
  | 'platform-warning'
  | 'blacklisted'
  | 'rate-limit'
  | 'missing-research'
  | 'manual-review-required';

export interface AuditLogEntry {
  id: string;
  at: string;
  level: 'info' | 'warning' | 'error';
  action: string;
  platform?: PlatformId;
  jobId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterExtractionResult {
  platform: PlatformId;
  status: JobSourceStatus;
  jobs: JobPosting[];
  warnings: string[];
}

export interface ApplyAttemptResult {
  ok: boolean;
  mode: ApplicationMode;
  jobId: string;
  pauseReason?: PauseReason;
  message: string;
  countAsApplication?: boolean;
}

export interface PlatformAdapter {
  platform: PlatformId;
  status: JobSourceStatus;
  hostPatterns: string[];
  canHandle(url: URL): boolean;
  extractJobs(document: Document, nowIso: string): AdapterExtractionResult;
  prepareApplication?(job: JobPosting, mode: ApplicationMode): ApplyAttemptResult;
}

export const defaultScoreWeights: ScoreWeights = {
  title: 24,
  skills: 30,
  location: 12,
  industry: 10,
  salary: 8,
  bonus: 5,
  benefits: 6,
  rest: 8,
  annualLeave: 4,
  research: 10,
  company: 6,
  blacklist: -100
};

export const defaultQueuePolicy: QueuePolicy = {
  dailyLimit: 20,
  minMinutesBetweenActions: 8,
  maxQueueSize: 100,
  mode: 'dry-run',
  requireResearchBeforeAuto: true
};

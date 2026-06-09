import type { AuditLogEntry } from './types';
import { stableId } from './text';

export function createAuditLogEntry(input: Omit<AuditLogEntry, 'id'>): AuditLogEntry {
  return {
    ...input,
    id: stableId([input.at, input.action, input.platform, input.jobId, input.message])
  };
}

export function appendAuditLog(entries: AuditLogEntry[], entry: Omit<AuditLogEntry, 'id'>): AuditLogEntry[] {
  return [createAuditLogEntry(entry), ...entries].slice(0, 500);
}

import { ACTIVITY_LOG_VIEW_STORAGE_KEY } from "./activity-logs";
import { DEVICE_FAVORITES_STORAGE_KEY, DEVICE_FILTER_VIEW_STORAGE_KEY } from "./device-list";
import { makeExportFilename, serializeJson } from "./export-data";
import { NOTIFICATION_INBOX_STORAGE_KEY, NOTIFICATION_INBOX_VIEW_STORAGE_KEY } from "./notification-inbox";
import {
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY,
  getPushEndpointFingerprint,
  parsePushSubscriptionRecord
} from "./push-notifications";
import { USER_PREFERENCES_STORAGE_KEY } from "./user-preferences";

export const LOCAL_APP_BACKUP_SCHEMA_VERSION = 1;
export const LOCAL_APP_BACKUP_SCOPE = "smart-home-local-state";

export type LocalAppBackupEntry = {
  key: string;
  label: string;
  present: boolean;
  redacted?: boolean;
  rawLength?: number;
  value: unknown;
};

export type LocalAppBackup = {
  schemaVersion: typeof LOCAL_APP_BACKUP_SCHEMA_VERSION;
  app: "smart-home-web";
  generatedAt: string;
  entries: LocalAppBackupEntry[];
  summary: {
    totalCount: number;
    presentCount: number;
    missingCount: number;
    redactedCount: number;
  };
};

export type StorageReader = Pick<Storage, "getItem">;

export const localAppBackupItems = [
  { key: USER_PREFERENCES_STORAGE_KEY, label: "本机偏好" },
  { key: DEVICE_FAVORITES_STORAGE_KEY, label: "收藏设备" },
  { key: DEVICE_FILTER_VIEW_STORAGE_KEY, label: "设备筛选视图" },
  { key: ACTIVITY_LOG_VIEW_STORAGE_KEY, label: "活动日志筛选视图" },
  { key: NOTIFICATION_INBOX_STORAGE_KEY, label: "通知收件箱" },
  { key: NOTIFICATION_INBOX_VIEW_STORAGE_KEY, label: "通知筛选视图" },
  { key: PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY, label: "推送同步快照" },
  { key: PUSH_SUBSCRIPTION_STORAGE_KEY, label: "推送订阅摘要", redacted: true }
] as const;

export function buildLocalAppBackup(storage: StorageReader, generatedAt: Date = new Date()): LocalAppBackup {
  const entries = localAppBackupItems.map((item) =>
    "redacted" in item && item.redacted
      ? readRedactedPushSubscriptionEntry(storage, item.key, item.label)
      : readJsonStorageEntry(storage, item.key, item.label)
  );
  const presentCount = entries.filter((entry) => entry.present).length;
  const redactedCount = entries.filter((entry) => entry.redacted).length;

  return {
    schemaVersion: LOCAL_APP_BACKUP_SCHEMA_VERSION,
    app: "smart-home-web",
    generatedAt: generatedAt.toISOString(),
    entries,
    summary: {
      totalCount: entries.length,
      presentCount,
      missingCount: entries.length - presentCount,
      redactedCount
    }
  };
}

export function serializeLocalAppBackup(backup: LocalAppBackup): string {
  return serializeJson(backup);
}

export function getLocalAppBackupFilename(date: Date = new Date()): string {
  return makeExportFilename(LOCAL_APP_BACKUP_SCOPE, "json", date);
}

function readJsonStorageEntry(storage: StorageReader, key: string, label: string): LocalAppBackupEntry {
  const raw = storage.getItem(key);

  if (raw === null) {
    return { key, label, present: false, value: null };
  }

  return {
    key,
    label,
    present: true,
    rawLength: raw.length,
    value: parseJsonValue(raw)
  };
}

function readRedactedPushSubscriptionEntry(storage: StorageReader, key: string, label: string): LocalAppBackupEntry {
  const raw = storage.getItem(key);

  if (raw === null) {
    return { key, label, present: false, redacted: true, value: null };
  }

  const record = parsePushSubscriptionRecord(raw);

  if (!record) {
    return {
      key,
      label,
      present: true,
      redacted: true,
      rawLength: raw.length,
      value: {
        parseError: true
      }
    };
  }

  return {
    key,
    label,
    present: true,
    redacted: true,
    rawLength: raw.length,
    value: {
      schemaVersion: record.schemaVersion,
      createdAt: record.createdAt,
      expirationTime: record.expirationTime,
      endpointFingerprint: getPushEndpointFingerprint(record.endpoint),
      hasP256dhKey: Boolean(record.keys.p256dh),
      hasAuthKey: Boolean(record.keys.auth)
    }
  };
}

function parseJsonValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { parseError: true };
  }
}

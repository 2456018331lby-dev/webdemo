import { ACTIVITY_LOG_VIEW_STORAGE_KEY, parseActivityLogView, serializeActivityLogView } from "./activity-logs";
import {
  DEVICE_FAVORITES_STORAGE_KEY,
  DEVICE_FILTER_VIEW_STORAGE_KEY,
  parseDeviceFilterView,
  serializeDeviceFilterView,
  serializeFavoriteIds
} from "./device-list";
import { makeExportFilename, serializeJson } from "./export-data";
import {
  NOTIFICATION_INBOX_STORAGE_KEY,
  NOTIFICATION_INBOX_VIEW_STORAGE_KEY,
  normalizeNotificationInboxPayload,
  parseNotificationInboxView,
  serializeNotificationInbox,
  serializeNotificationInboxView
} from "./notification-inbox";
import {
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY,
  getPushEndpointFingerprint,
  parsePushSubscriptionRecord,
  parsePushSubscriptionSyncRecord,
  serializePushSubscriptionSyncRecord
} from "./push-notifications";
import { SETTINGS_DEVICES_STORAGE_KEY, normalizeSettingsDevicesState } from "./settings-devices";
import {
  USER_PREFERENCES_STORAGE_KEY,
  normalizeUserPreferencesState,
  serializeUserPreferences
} from "./user-preferences";

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
export type StorageWriter = Pick<Storage, "setItem">;

export type LocalAppBackupRestoreStatus =
  | "restore"
  | "overwrite"
  | "missing"
  | "redacted"
  | "invalid"
  | "unknown";

export type LocalAppBackupRestoreItem = {
  key: string;
  label: string;
  status: LocalAppBackupRestoreStatus;
  reason: string;
  rawLength?: number;
  currentRawLength?: number;
  restoreValue: string | null;
};

export type LocalAppBackupRestorePlan = {
  backup: LocalAppBackup;
  items: LocalAppBackupRestoreItem[];
  summary: {
    restorableCount: number;
    overwriteCount: number;
    skippedCount: number;
    totalCount: number;
  };
};

export const localAppBackupItems = [
  { key: USER_PREFERENCES_STORAGE_KEY, label: "本机偏好" },
  { key: SETTINGS_DEVICES_STORAGE_KEY, label: "设备维护状态" },
  { key: DEVICE_FAVORITES_STORAGE_KEY, label: "收藏设备" },
  { key: DEVICE_FILTER_VIEW_STORAGE_KEY, label: "设备筛选视图" },
  { key: ACTIVITY_LOG_VIEW_STORAGE_KEY, label: "活动日志筛选视图" },
  { key: NOTIFICATION_INBOX_STORAGE_KEY, label: "通知收件箱" },
  { key: NOTIFICATION_INBOX_VIEW_STORAGE_KEY, label: "通知筛选视图" },
  { key: PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY, label: "推送同步快照" },
  { key: PUSH_SUBSCRIPTION_STORAGE_KEY, label: "推送订阅摘要", redacted: true }
] as const;

const localAppBackupItemsByKey = new Map<string, (typeof localAppBackupItems)[number]>(
  localAppBackupItems.map((item) => [item.key, item])
);

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

export function parseLocalAppBackupText(text: string): LocalAppBackup | null {
  try {
    return normalizeLocalAppBackup(JSON.parse(text));
  } catch {
    return null;
  }
}

export function createLocalAppBackupRestorePlan(
  storage: StorageReader,
  backup: LocalAppBackup
): LocalAppBackupRestorePlan {
  const items = backup.entries.map((entry) => {
    const knownItem = localAppBackupItemsByKey.get(entry.key);

    if (!knownItem) {
      return createRestoreItem(entry, "unknown", "备份包含当前版本未识别的状态项", null, storage);
    }

    if (entry.redacted || knownItem.key === PUSH_SUBSCRIPTION_STORAGE_KEY) {
      return createRestoreItem(entry, "redacted", "推送订阅端点和密钥不会从备份恢复", null, storage);
    }

    if (!entry.present) {
      return createRestoreItem(entry, "missing", "备份中该状态项为空，保留当前本机状态", null, storage);
    }

    const restoreValue = stringifyRestorableValue(entry.key, entry.value);

    if (restoreValue === null) {
      return createRestoreItem(entry, "invalid", getInvalidRestoreReason(entry.key), null, storage);
    }

    const currentRaw = storage.getItem(entry.key);
    const status: LocalAppBackupRestoreStatus = currentRaw === null ? "restore" : "overwrite";
    const reason = currentRaw === null ? "将写入本机状态" : "将覆盖当前本机状态";

    return createRestoreItem(entry, status, reason, restoreValue, storage);
  });
  const restorableCount = items.filter((item) => item.status === "restore" || item.status === "overwrite").length;
  const overwriteCount = items.filter((item) => item.status === "overwrite").length;

  return {
    backup,
    items,
    summary: {
      restorableCount,
      overwriteCount,
      skippedCount: items.length - restorableCount,
      totalCount: items.length
    }
  };
}

export function applyLocalAppBackupRestorePlan(storage: StorageWriter, plan: LocalAppBackupRestorePlan): number {
  let restoredCount = 0;

  for (const item of plan.items) {
    if ((item.status === "restore" || item.status === "overwrite") && item.restoreValue !== null) {
      storage.setItem(item.key, item.restoreValue);
      restoredCount += 1;
    }
  }

  return restoredCount;
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

function normalizeLocalAppBackup(value: unknown): LocalAppBackup | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.schemaVersion !== LOCAL_APP_BACKUP_SCHEMA_VERSION ||
    value.app !== "smart-home-web" ||
    typeof value.generatedAt !== "string" ||
    !Array.isArray(value.entries)
  ) {
    return null;
  }

  const entries = value.entries
    .map(normalizeLocalAppBackupEntry)
    .filter((entry): entry is LocalAppBackupEntry => entry !== null);

  if (entries.length !== value.entries.length) {
    return null;
  }

  const presentCount = entries.filter((entry) => entry.present).length;
  const redactedCount = entries.filter((entry) => entry.redacted).length;

  return {
    schemaVersion: LOCAL_APP_BACKUP_SCHEMA_VERSION,
    app: "smart-home-web",
    generatedAt: value.generatedAt,
    entries,
    summary: {
      totalCount: entries.length,
      presentCount,
      missingCount: entries.length - presentCount,
      redactedCount
    }
  };
}

function normalizeLocalAppBackupEntry(value: unknown): LocalAppBackupEntry | null {
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.label !== "string") {
    return null;
  }

  if (typeof value.present !== "boolean") {
    return null;
  }

  return {
    key: value.key,
    label: value.label,
    present: value.present,
    redacted: typeof value.redacted === "boolean" ? value.redacted : undefined,
    rawLength: typeof value.rawLength === "number" ? value.rawLength : undefined,
    value: "value" in value ? value.value : null
  };
}

function createRestoreItem(
  entry: LocalAppBackupEntry,
  status: LocalAppBackupRestoreStatus,
  reason: string,
  restoreValue: string | null,
  storage: StorageReader
): LocalAppBackupRestoreItem {
  const currentRaw = storage.getItem(entry.key);

  return {
    key: entry.key,
    label: entry.label,
    status,
    reason,
    rawLength: entry.rawLength,
    currentRawLength: currentRaw === null ? undefined : currentRaw.length,
    restoreValue
  };
}

function stringifyRestorableValue(key: string, value: unknown): string | null {
  if (isParseErrorValue(value)) {
    return null;
  }

  if (key === USER_PREFERENCES_STORAGE_KEY) {
    const preferences = normalizeUserPreferencesState(value);
    return preferences ? serializeUserPreferences(preferences) : null;
  }

  if (key === SETTINGS_DEVICES_STORAGE_KEY) {
    const normalizedState = normalizeSettingsDevicesState(value);
    return normalizedState ? JSON.stringify(normalizedState) : null;
  }

  if (key === DEVICE_FAVORITES_STORAGE_KEY) {
    return stringifyFavoriteIds(value);
  }

  if (key === DEVICE_FILTER_VIEW_STORAGE_KEY) {
    return stringifyParsedStorageState(value, parseDeviceFilterView, serializeDeviceFilterView);
  }

  if (key === ACTIVITY_LOG_VIEW_STORAGE_KEY) {
    return stringifyParsedStorageState(value, parseActivityLogView, serializeActivityLogView);
  }

  if (key === NOTIFICATION_INBOX_STORAGE_KEY) {
    const payload = normalizeNotificationInboxPayload(value);
    return payload ? serializeNotificationInbox(payload.items) : null;
  }

  if (key === NOTIFICATION_INBOX_VIEW_STORAGE_KEY) {
    return stringifyParsedStorageState(value, parseNotificationInboxView, serializeNotificationInboxView);
  }

  if (key === PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY) {
    return stringifyParsedStorageState(
      value,
      parsePushSubscriptionSyncRecord,
      serializePushSubscriptionSyncRecord
    );
  }

  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? serialized : null;
}

function getInvalidRestoreReason(key: string): string {
  if (key === USER_PREFERENCES_STORAGE_KEY) {
    return "备份中的本机偏好不符合当前 schema，已跳过";
  }

  if (key === SETTINGS_DEVICES_STORAGE_KEY) {
    return "备份中的设备维护状态不符合当前 schema，已跳过";
  }

  if (key === DEVICE_FAVORITES_STORAGE_KEY) {
    return "备份中的收藏设备清单不符合当前 schema，已跳过";
  }

  if (key === DEVICE_FILTER_VIEW_STORAGE_KEY) {
    return "备份中的设备筛选视图不符合当前 schema，已跳过";
  }

  if (key === ACTIVITY_LOG_VIEW_STORAGE_KEY) {
    return "备份中的活动日志筛选视图不符合当前 schema，已跳过";
  }

  if (key === NOTIFICATION_INBOX_STORAGE_KEY) {
    return "备份中的通知收件箱不符合当前 schema，已跳过";
  }

  if (key === NOTIFICATION_INBOX_VIEW_STORAGE_KEY) {
    return "备份中的通知筛选视图不符合当前 schema，已跳过";
  }

  if (key === PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY) {
    return "备份中的推送同步快照不符合当前 schema，已跳过";
  }

  return "备份值不是可恢复的 JSON 状态";
}

function stringifyFavoriteIds(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (!value.every((item): item is string => typeof item === "string" && item.trim() !== "")) {
    return null;
  }

  return serializeFavoriteIds(value);
}

function stringifyParsedStorageState<T>(
  value: unknown,
  parse: (raw: string | null) => T | null,
  serialize: (state: T) => string
): string | null {
  const serialized = JSON.stringify(value);

  if (typeof serialized !== "string") {
    return null;
  }

  const parsed = parse(serialized);
  return parsed ? serialize(parsed) : null;
}

function isParseErrorValue(value: unknown): boolean {
  return isRecord(value) && value.parseError === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

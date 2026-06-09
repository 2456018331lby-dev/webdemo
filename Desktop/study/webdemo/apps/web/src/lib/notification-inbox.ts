import type { NotificationRules, UserPreferences } from "./user-preferences";

export const NOTIFICATION_INBOX_STORAGE_KEY = "smart-home-notification-inbox-v1";
export const NOTIFICATION_INBOX_VIEW_STORAGE_KEY = "smart-home-notification-inbox-view-v1";

export type NotificationInboxPriority = "critical" | "warning" | "normal" | "summary";
export type NotificationInboxState = "unread" | "read" | "archived";
export type NotificationInboxFilter = "all" | "unread" | "critical" | "archived";
export type NotificationInboxSource = "device" | "system" | "push" | "summary";
export type NotificationInboxPriorityFilter = "all" | NotificationInboxPriority;
export type NotificationInboxSourceFilter = "all" | NotificationInboxSource;
export type NotificationRuleKey = keyof NotificationRules;

export type NotificationInboxItem = {
  schemaVersion: 1;
  id: string;
  title: string;
  message: string;
  timestamp: string;
  source: NotificationInboxSource;
  priority: NotificationInboxPriority;
  state: NotificationInboxState;
  ruleKey: NotificationRuleKey;
  deliveryTarget: string;
  deviceId?: string;
  deviceName?: string;
};

export type NotificationInboxSummary = {
  totalVisible: number;
  unread: number;
  criticalUnread: number;
  delayedByQuietHours: number;
  archived: number;
};

export type NotificationInboxAdvancedFilters = {
  query: string;
  deviceId: string;
  priority: NotificationInboxPriorityFilter;
  source: NotificationInboxSourceFilter;
};

export type NotificationInboxDeviceOption = {
  id: string;
  name: string;
  count: number;
};

export type NotificationInboxViewState = {
  schemaVersion: 1;
  filter: NotificationInboxFilter;
  advancedFilters: NotificationInboxAdvancedFilters;
  savedAt: string;
};

type NotificationInboxPayload = {
  schemaVersion: 1;
  items: NotificationInboxItem[];
};

type NotificationInboxItemInput = Omit<NotificationInboxItem, "schemaVersion" | "timestamp" | "state"> & {
  timestamp?: string;
  state?: NotificationInboxState;
};

const maxInboxItems = 40;

export const defaultNotificationInboxAdvancedFilters: NotificationInboxAdvancedFilters = {
  query: "",
  deviceId: "all",
  priority: "all",
  source: "all"
};

export const seedNotificationInboxItems: NotificationInboxItem[] = [
  {
    schemaVersion: 1,
    id: "notice-offline-relay-02",
    title: "厨房排风扇继电器离线",
    message: "设备超过心跳窗口未上报，建议检查 ESP32S3 供电、WiFi 或 UART 桥接状态。",
    timestamp: "2026-06-07T07:40:00.000Z",
    source: "device",
    priority: "critical",
    state: "unread",
    ruleKey: "offlineAlerts",
    deliveryTarget: "PWA 推送 / 应用内",
    deviceId: "device-relay-02",
    deviceName: "排风扇继电器"
  },
  {
    schemaVersion: 1,
    id: "notice-air-quality-warning",
    title: "卧室空气质量需要关注",
    message: "PM2.5 与 CO2 趋势高于舒适区间，建议联动排风扇或打开窗户。",
    timestamp: "2026-06-07T06:55:00.000Z",
    source: "device",
    priority: "warning",
    state: "unread",
    ruleKey: "telemetryWarnings",
    deliveryTarget: "应用内 / 安静时段后推送",
    deviceId: "device-sensor-02",
    deviceName: "空气质量传感器"
  },
  {
    schemaVersion: 1,
    id: "notice-command-result-relay-01",
    title: "主灯继电器命令已确认",
    message: "最近一次控制命令已被设备确认，期望状态和上报状态保持一致。",
    timestamp: "2026-06-07T05:18:00.000Z",
    source: "device",
    priority: "normal",
    state: "read",
    ruleKey: "commandResults",
    deliveryTarget: "应用内",
    deviceId: "device-relay-01",
    deviceName: "主灯继电器"
  },
  {
    schemaVersion: 1,
    id: "notice-weekly-summary",
    title: "本周运行摘要待生成",
    message: "当前设置未启用每周摘要；启用后会汇总在线率、告警数和命令成功率。",
    timestamp: "2026-06-07T00:30:00.000Z",
    source: "summary",
    priority: "summary",
    state: "read",
    ruleKey: "weeklySummary",
    deliveryTarget: "邮件摘要 / 应用内"
  }
];

export function parseNotificationInbox(raw: string | null): NotificationInboxItem[] {
  if (!raw) {
    return seedNotificationInboxItems;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationInboxPayload>;

    return normalizeNotificationInboxItems(parsed.items);
  } catch {
    return seedNotificationInboxItems;
  }
}

export function serializeNotificationInbox(items: NotificationInboxItem[]): string {
  const payload: NotificationInboxPayload = {
    schemaVersion: 1,
    items: normalizeNotificationInboxItems(items)
  };

  return JSON.stringify(payload);
}

export function parseNotificationInboxView(raw: string | null): NotificationInboxViewState | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeNotificationInboxViewState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeNotificationInboxView(view: NotificationInboxViewState): string {
  return JSON.stringify(normalizeNotificationInboxViewState(view));
}

export function createNotificationInboxItem(
  input: NotificationInboxItemInput,
  createdAt: Date = new Date()
): NotificationInboxItem {
  return {
    ...input,
    schemaVersion: 1,
    timestamp: input.timestamp ?? createdAt.toISOString(),
    state: input.state ?? "unread"
  };
}

export function createNotificationInboxViewState(
  filter: NotificationInboxFilter,
  advancedFilters: NotificationInboxAdvancedFilters,
  savedAt: Date = new Date()
): NotificationInboxViewState {
  return {
    schemaVersion: 1,
    filter,
    advancedFilters: normalizeNotificationInboxAdvancedFilters(advancedFilters),
    savedAt: savedAt.toISOString()
  };
}

export function mergeNotificationInboxItems(
  currentItems: NotificationInboxItem[],
  nextItem: NotificationInboxItem
): NotificationInboxItem[] {
  return normalizeNotificationInboxItems([
    nextItem,
    ...currentItems.filter((item) => item.id !== nextItem.id)
  ]);
}

export function markNotificationInboxItem(
  items: NotificationInboxItem[],
  id: string,
  state: NotificationInboxState
): NotificationInboxItem[] {
  return normalizeNotificationInboxItems(
    items.map((item) => (item.id === id ? { ...item, state } : item))
  );
}

export function markAllNotificationInboxItemsRead(items: NotificationInboxItem[]): NotificationInboxItem[] {
  return normalizeNotificationInboxItems(
    items.map((item) => (item.state === "archived" ? item : { ...item, state: "read" }))
  );
}

export function removeArchivedNotificationInboxItems(items: NotificationInboxItem[]): NotificationInboxItem[] {
  return normalizeNotificationInboxItems(items.filter((item) => item.state !== "archived"));
}

export function getVisibleNotificationInboxItems(
  items: NotificationInboxItem[],
  preferences: UserPreferences,
  filter: NotificationInboxFilter,
  advancedFilters: NotificationInboxAdvancedFilters = defaultNotificationInboxAdvancedFilters
): NotificationInboxItem[] {
  return getPolicyVisibleItems(items, preferences)
    .filter((item) => {
      if (filter === "archived") {
        return item.state === "archived";
      }

      if (item.state === "archived") {
        return false;
      }

      if (filter === "unread") {
        return item.state === "unread";
      }

      if (filter === "critical") {
        return item.priority === "critical";
      }

      return true;
    })
    .filter((item) => matchesAdvancedFilters(item, advancedFilters))
    .sort(compareNotificationItems);
}

export function getNotificationInboxDeviceOptions(
  items: NotificationInboxItem[],
  preferences: UserPreferences
): NotificationInboxDeviceOption[] {
  const deviceCounts = new Map<string, NotificationInboxDeviceOption>();

  for (const item of getPolicyVisibleItems(items, preferences)) {
    if (!item.deviceId || !item.deviceName || item.state === "archived") {
      continue;
    }

    const current = deviceCounts.get(item.deviceId);
    deviceCounts.set(item.deviceId, {
      id: item.deviceId,
      name: item.deviceName,
      count: (current?.count ?? 0) + 1
    });
  }

  return Array.from(deviceCounts.values()).sort((a, b) =>
    b.count === a.count ? a.name.localeCompare(b.name, "zh-CN") : b.count - a.count
  );
}

export function getNotificationInboxSummary(
  items: NotificationInboxItem[],
  preferences: UserPreferences
): NotificationInboxSummary {
  const policyVisibleItems = getPolicyVisibleItems(items, preferences);
  const activeItems = policyVisibleItems.filter((item) => item.state !== "archived");

  return {
    totalVisible: activeItems.length,
    unread: activeItems.filter((item) => item.state === "unread").length,
    criticalUnread: activeItems.filter((item) => item.state === "unread" && item.priority === "critical").length,
    delayedByQuietHours:
      preferences.quietHoursEnabled
        ? activeItems.filter((item) => item.state === "unread" && item.priority !== "critical").length
        : 0,
    archived: policyVisibleItems.filter((item) => item.state === "archived").length
  };
}

export function hasActiveNotificationInboxAdvancedFilters(filters: NotificationInboxAdvancedFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.deviceId !== defaultNotificationInboxAdvancedFilters.deviceId ||
    filters.priority !== defaultNotificationInboxAdvancedFilters.priority ||
    filters.source !== defaultNotificationInboxAdvancedFilters.source
  );
}

function getPolicyVisibleItems(
  items: NotificationInboxItem[],
  preferences: UserPreferences
): NotificationInboxItem[] {
  return normalizeNotificationInboxItems(items).filter((item) => {
    if (!preferences.notificationRules[item.ruleKey]) {
      return false;
    }

    if (preferences.notificationChannels.criticalOnly && item.priority !== "critical") {
      return false;
    }

    return true;
  });
}

function matchesAdvancedFilters(
  item: NotificationInboxItem,
  filters: NotificationInboxAdvancedFilters
): boolean {
  const query = filters.query.trim().toLowerCase();

  if (
    query !== "" &&
    ![
      item.title,
      item.message,
      item.deviceId ?? "",
      item.deviceName ?? "",
      item.deliveryTarget
    ].some((value) => value.toLowerCase().includes(query))
  ) {
    return false;
  }

  if (filters.deviceId !== "all" && item.deviceId !== filters.deviceId) {
    return false;
  }

  if (filters.priority !== "all" && item.priority !== filters.priority) {
    return false;
  }

  if (filters.source !== "all" && item.source !== filters.source) {
    return false;
  }

  return true;
}

function normalizeNotificationInboxViewState(value: unknown): NotificationInboxViewState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.savedAt !== "string" ||
    Number.isNaN(new Date(value.savedAt).getTime())
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    filter: normalizeInboxFilter(value.filter),
    advancedFilters: normalizeNotificationInboxAdvancedFilters(value.advancedFilters),
    savedAt: value.savedAt
  };
}

function normalizeNotificationInboxAdvancedFilters(value: unknown): NotificationInboxAdvancedFilters {
  if (!isRecord(value)) {
    return defaultNotificationInboxAdvancedFilters;
  }

  return {
    query: typeof value.query === "string" ? value.query : defaultNotificationInboxAdvancedFilters.query,
    deviceId:
      typeof value.deviceId === "string" && value.deviceId.trim() !== ""
        ? value.deviceId
        : defaultNotificationInboxAdvancedFilters.deviceId,
    priority: normalizePriorityFilter(value.priority),
    source: normalizeSourceFilter(value.source)
  };
}

function normalizeNotificationInboxItems(value: unknown): NotificationInboxItem[] {
  if (!Array.isArray(value)) {
    return seedNotificationInboxItems;
  }

  const seen = new Set<string>();
  const normalized: NotificationInboxItem[] = [];

  for (const item of value) {
    const normalizedItem = normalizeNotificationInboxItem(item);

    if (normalizedItem && !seen.has(normalizedItem.id)) {
      seen.add(normalizedItem.id);
      normalized.push(normalizedItem);
    }
  }

  return normalized.sort(compareNotificationItems).slice(0, maxInboxItems);
}

function normalizeNotificationInboxItem(value: unknown): NotificationInboxItem | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.id !== "string") {
    return null;
  }

  if (
    typeof value.title !== "string" ||
    typeof value.message !== "string" ||
    typeof value.timestamp !== "string" ||
    typeof value.deliveryTarget !== "string"
  ) {
    return null;
  }

  const priority = normalizePriority(value.priority);
  const state = normalizeState(value.state);
  const source = normalizeSource(value.source);
  const ruleKey = normalizeRuleKey(value.ruleKey);

  if (!priority || !state || !source || !ruleKey) {
    return null;
  }

  return {
    schemaVersion: 1,
    id: value.id,
    title: value.title,
    message: value.message,
    timestamp: value.timestamp,
    source,
    priority,
    state,
    ruleKey,
    deliveryTarget: value.deliveryTarget,
    ...(typeof value.deviceId === "string" ? { deviceId: value.deviceId } : {}),
    ...(typeof value.deviceName === "string" ? { deviceName: value.deviceName } : {})
  };
}

function normalizePriority(value: unknown): NotificationInboxPriority | null {
  if (value === "critical" || value === "warning" || value === "normal" || value === "summary") {
    return value;
  }

  return null;
}

function normalizeState(value: unknown): NotificationInboxState | null {
  if (value === "unread" || value === "read" || value === "archived") {
    return value;
  }

  return null;
}

function normalizeSource(value: unknown): NotificationInboxSource | null {
  if (value === "device" || value === "system" || value === "push" || value === "summary") {
    return value;
  }

  return null;
}

function normalizeRuleKey(value: unknown): NotificationRuleKey | null {
  if (
    value === "offlineAlerts" ||
    value === "telemetryWarnings" ||
    value === "commandResults" ||
    value === "weeklySummary"
  ) {
    return value;
  }

  return null;
}

function normalizeInboxFilter(value: unknown): NotificationInboxFilter {
  if (value === "all" || value === "unread" || value === "critical" || value === "archived") {
    return value;
  }

  return "all";
}

function normalizePriorityFilter(value: unknown): NotificationInboxPriorityFilter {
  if (value === "all") {
    return value;
  }

  return normalizePriority(value) ?? defaultNotificationInboxAdvancedFilters.priority;
}

function normalizeSourceFilter(value: unknown): NotificationInboxSourceFilter {
  if (value === "all") {
    return value;
  }

  return normalizeSource(value) ?? defaultNotificationInboxAdvancedFilters.source;
}

function compareNotificationItems(a: NotificationInboxItem, b: NotificationInboxItem): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

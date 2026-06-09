export type ActivityLog = {
  id: string;
  timestamp: string;
  type: "command" | "alert" | "system" | "device";
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  deviceId?: string;
  deviceName?: string;
};

export const ACTIVITY_LOG_VIEW_STORAGE_KEY = "smart-home-activity-log-view-v1";

export type ActivityLogFilterType = "all" | ActivityLog["type"];
export type ActivityLogFilterLevel = "all" | ActivityLog["level"];

export type ActivityLogFilters = {
  query: string;
  type: ActivityLogFilterType;
  level: ActivityLogFilterLevel;
};

export type ActivityLogViewState = {
  schemaVersion: 1;
  filters: ActivityLogFilters;
  savedAt: string;
};

export const defaultActivityLogFilters: ActivityLogFilters = {
  query: "",
  type: "all",
  level: "all"
};

export const activityLogs: ActivityLog[] = [
  {
    id: "log-001",
    timestamp: "2026-05-28T10:30:00Z",
    type: "command",
    level: "success",
    title: "命令执行成功",
    message: "主灯继电器已开启",
    deviceId: "device-relay-01",
    deviceName: "主灯继电器"
  },
  {
    id: "log-002",
    timestamp: "2026-05-28T10:28:00Z",
    type: "alert",
    level: "warning",
    title: "设备离线",
    message: "排风扇继电器已离线超过 2 分钟",
    deviceId: "device-relay-02",
    deviceName: "排风扇继电器"
  },
  {
    id: "log-003",
    timestamp: "2026-05-28T10:25:00Z",
    type: "system",
    level: "info",
    title: "系统启动",
    message: "智能家居控制系统已启动"
  },
  {
    id: "log-004",
    timestamp: "2026-05-28T10:20:00Z",
    type: "device",
    level: "info",
    title: "遥测数据更新",
    message: "温湿度传感器: 温度 24.6°C, 湿度 48.1%",
    deviceId: "device-sensor-01",
    deviceName: "温湿度传感器"
  },
  {
    id: "log-005",
    timestamp: "2026-05-28T10:15:00Z",
    type: "command",
    level: "error",
    title: "命令超时",
    message: "排风扇继电器命令超时，未收到 ack",
    deviceId: "device-relay-02",
    deviceName: "排风扇继电器"
  },
  {
    id: "log-006",
    timestamp: "2026-05-28T10:10:00Z",
    type: "alert",
    level: "warning",
    title: "信号强度弱",
    message: "床头灯继电器信号强度 -72 dBm",
    deviceId: "device-relay-03",
    deviceName: "床头灯继电器"
  },
  {
    id: "log-007",
    timestamp: "2026-05-28T10:05:00Z",
    type: "command",
    level: "success",
    title: "命令执行成功",
    message: "照明继电器已开启",
    deviceId: "device-relay-04",
    deviceName: "照明继电器"
  },
  {
    id: "log-008",
    timestamp: "2026-05-28T10:00:00Z",
    type: "system",
    level: "info",
    title: "定期检查",
    message: "系统完成设备状态检查，5 台设备在线"
  }
];

export function getRecentLogs(count: number = 10): ActivityLog[] {
  return activityLogs
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, count);
}

export function getLogsByDevice(deviceId: string): ActivityLog[] {
  return activityLogs.filter(log => log.deviceId === deviceId);
}

export function getLogsByType(type: ActivityLog["type"]): ActivityLog[] {
  return activityLogs.filter(log => log.type === type);
}

export function getLogsByLevel(level: ActivityLog["level"]): ActivityLog[] {
  return activityLogs.filter(log => log.level === level);
}

export function getFilteredActivityLogs(
  logs: ActivityLog[],
  filters: ActivityLogFilters = defaultActivityLogFilters
): ActivityLog[] {
  const normalizedFilters = normalizeActivityLogFilters(filters);
  const query = normalizedFilters.query.trim().toLowerCase();

  return logs
    .filter((log) => {
      const matchesType = normalizedFilters.type === "all" || log.type === normalizedFilters.type;
      const matchesLevel = normalizedFilters.level === "all" || log.level === normalizedFilters.level;
      const matchesSearch =
        query === "" ||
        log.title.toLowerCase().includes(query) ||
        log.message.toLowerCase().includes(query) ||
        (log.deviceName ?? "").toLowerCase().includes(query) ||
        (log.deviceId ?? "").toLowerCase().includes(query);

      return matchesType && matchesLevel && matchesSearch;
    })
    .sort(compareActivityLogs);
}

export function hasActiveActivityLogFilters(filters: ActivityLogFilters): boolean {
  const normalizedFilters = normalizeActivityLogFilters(filters);

  return (
    normalizedFilters.query.trim() !== "" ||
    normalizedFilters.type !== defaultActivityLogFilters.type ||
    normalizedFilters.level !== defaultActivityLogFilters.level
  );
}

export function createActivityLogViewState(
  filters: ActivityLogFilters,
  savedAt: Date = new Date()
): ActivityLogViewState {
  return {
    schemaVersion: 1,
    filters: normalizeActivityLogFilters(filters),
    savedAt: savedAt.toISOString()
  };
}

export function parseActivityLogView(raw: string | null): ActivityLogViewState | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeActivityLogViewState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeActivityLogView(view: ActivityLogViewState): string {
  return JSON.stringify(normalizeActivityLogViewState(view));
}

export function normalizeActivityLogFilters(value: unknown): ActivityLogFilters {
  if (!isRecord(value)) {
    return defaultActivityLogFilters;
  }

  return {
    query: typeof value.query === "string" ? value.query : defaultActivityLogFilters.query,
    type: normalizeActivityLogFilterType(value.type),
    level: normalizeActivityLogFilterLevel(value.level)
  };
}

function normalizeActivityLogViewState(value: unknown): ActivityLogViewState | null {
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
    filters: normalizeActivityLogFilters(value.filters),
    savedAt: value.savedAt
  };
}

function normalizeActivityLogFilterType(value: unknown): ActivityLogFilterType {
  if (value === "all" || value === "command" || value === "alert" || value === "system" || value === "device") {
    return value;
  }

  return defaultActivityLogFilters.type;
}

function normalizeActivityLogFilterLevel(value: unknown): ActivityLogFilterLevel {
  if (value === "all" || value === "info" || value === "warning" || value === "error" || value === "success") {
    return value;
  }

  return defaultActivityLogFilters.level;
}

function compareActivityLogs(a: ActivityLog, b: ActivityLog): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

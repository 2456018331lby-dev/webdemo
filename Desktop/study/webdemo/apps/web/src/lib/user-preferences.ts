export const USER_PREFERENCES_STORAGE_KEY = "smart-home-user-preferences-v1";

export type DashboardDensity = "comfortable" | "compact";
export type DefaultLanding = "dashboard" | "homes" | "devices" | "activity";

export type NotificationChannels = {
  push: boolean;
  emailDigest: boolean;
  criticalOnly: boolean;
};

export type NotificationRules = {
  offlineAlerts: boolean;
  telemetryWarnings: boolean;
  commandResults: boolean;
  weeklySummary: boolean;
};

export type UserPreferences = {
  schemaVersion: 1;
  dashboardDensity: DashboardDensity;
  defaultLanding: DefaultLanding;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationChannels: NotificationChannels;
  notificationRules: NotificationRules;
};

export const defaultUserPreferences: UserPreferences = {
  schemaVersion: 1,
  dashboardDensity: "comfortable",
  defaultLanding: "dashboard",
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  notificationChannels: {
    push: true,
    emailDigest: false,
    criticalOnly: false
  },
  notificationRules: {
    offlineAlerts: true,
    telemetryWarnings: true,
    commandResults: true,
    weeklySummary: false
  }
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseUserPreferences(raw: string | null): UserPreferences {
  if (!raw) {
    return normalizeUserPreferences(null);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;

    return normalizeUserPreferences(parsed);
  } catch {
    return normalizeUserPreferences(null);
  }
}

export function serializeUserPreferences(preferences: UserPreferences): string {
  return JSON.stringify(normalizeUserPreferences(preferences));
}

export function normalizeUserPreferencesState(value: unknown): UserPreferences | null {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return null;
  }

  return normalizeUserPreferences(value as Partial<UserPreferences>);
}

export function normalizeUserPreferences(
  preferences: Partial<UserPreferences> | null | undefined
): UserPreferences {
  return {
    ...defaultUserPreferences,
    dashboardDensity:
      preferences?.dashboardDensity === "compact" ? "compact" : defaultUserPreferences.dashboardDensity,
    defaultLanding: normalizeLanding(preferences?.defaultLanding),
    quietHoursEnabled:
      typeof preferences?.quietHoursEnabled === "boolean"
        ? preferences.quietHoursEnabled
        : defaultUserPreferences.quietHoursEnabled,
    quietHoursStart: normalizeTime(preferences?.quietHoursStart, defaultUserPreferences.quietHoursStart),
    quietHoursEnd: normalizeTime(preferences?.quietHoursEnd, defaultUserPreferences.quietHoursEnd),
    notificationChannels: {
      ...defaultUserPreferences.notificationChannels,
      ...normalizeChannelFlags(preferences?.notificationChannels)
    },
    notificationRules: {
      ...defaultUserPreferences.notificationRules,
      ...normalizeRuleFlags(preferences?.notificationRules)
    }
  };
}

export function countEnabledNotificationRules(rules: NotificationRules): number {
  return Object.values(rules).filter(Boolean).length;
}

export function getNotificationDeliverySummary(preferences: UserPreferences): string[] {
  const channels = [];

  if (preferences.notificationChannels.push) {
    channels.push("PWA 推送");
  }

  if (preferences.notificationChannels.emailDigest) {
    channels.push("邮件摘要");
  }

  if (channels.length === 0) {
    channels.push("仅应用内记录");
  }

  return [
    channels.join(" + "),
    preferences.notificationChannels.criticalOnly ? "仅关键事件" : "全部已选事件",
    preferences.quietHoursEnabled
      ? `安静时段 ${preferences.quietHoursStart}-${preferences.quietHoursEnd}`
      : "无安静时段"
  ];
}

function normalizeLanding(value: unknown): DefaultLanding {
  if (value === "homes" || value === "devices" || value === "activity") {
    return value;
  }

  return defaultUserPreferences.defaultLanding;
}

function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && timePattern.test(value) ? value : fallback;
}

function normalizeChannelFlags(value: unknown): Partial<NotificationChannels> {
  if (!isRecord(value)) {
    return {};
  }

  const flags: Partial<NotificationChannels> = {};
  assignBooleanFlag(flags, "push", value.push);
  assignBooleanFlag(flags, "emailDigest", value.emailDigest);
  assignBooleanFlag(flags, "criticalOnly", value.criticalOnly);

  return flags;
}

function normalizeRuleFlags(value: unknown): Partial<NotificationRules> {
  if (!isRecord(value)) {
    return {};
  }

  const flags: Partial<NotificationRules> = {};
  assignBooleanFlag(flags, "offlineAlerts", value.offlineAlerts);
  assignBooleanFlag(flags, "telemetryWarnings", value.telemetryWarnings);
  assignBooleanFlag(flags, "commandResults", value.commandResults);
  assignBooleanFlag(flags, "weeklySummary", value.weeklySummary);

  return flags;
}

function assignBooleanFlag<T extends Record<string, boolean>>(
  target: Partial<T>,
  key: keyof T,
  value: unknown
) {
  if (typeof value === "boolean") {
    target[key] = value as T[keyof T];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

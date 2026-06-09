import { describe, expect, it } from "vitest";
import {
  countEnabledNotificationRules,
  defaultUserPreferences,
  getNotificationDeliverySummary,
  parseUserPreferences,
  serializeUserPreferences
} from "./user-preferences";

describe("user preferences helpers", () => {
  it("falls back to defaults for empty or invalid storage values", () => {
    expect(parseUserPreferences(null)).toEqual(defaultUserPreferences);
    expect(parseUserPreferences("not-json")).toEqual(defaultUserPreferences);
  });

  it("merges valid persisted fields without letting invalid values erase defaults", () => {
    const parsed = parseUserPreferences(
      JSON.stringify({
        dashboardDensity: "compact",
        defaultLanding: "devices",
        quietHoursEnabled: false,
        quietHoursStart: "25:99",
        notificationChannels: {
          push: false,
          emailDigest: true,
          criticalOnly: "yes"
        },
        notificationRules: {
          offlineAlerts: false,
          telemetryWarnings: "no",
          weeklySummary: true
        }
      })
    );

    expect(parsed).toEqual({
      ...defaultUserPreferences,
      dashboardDensity: "compact",
      defaultLanding: "devices",
      quietHoursEnabled: false,
      quietHoursStart: defaultUserPreferences.quietHoursStart,
      notificationChannels: {
        push: false,
        emailDigest: true,
        criticalOnly: defaultUserPreferences.notificationChannels.criticalOnly
      },
      notificationRules: {
        offlineAlerts: false,
        telemetryWarnings: defaultUserPreferences.notificationRules.telemetryWarnings,
        commandResults: defaultUserPreferences.notificationRules.commandResults,
        weeklySummary: true
      }
    });
  });

  it("serializes preferences in normalized shape", () => {
    const serialized = serializeUserPreferences({
      ...defaultUserPreferences,
      defaultLanding: "activity",
      quietHoursStart: "06:30",
      quietHoursEnd: "21:15"
    });

    expect(JSON.parse(serialized)).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        defaultLanding: "activity",
        quietHoursStart: "06:30",
        quietHoursEnd: "21:15"
      })
    );
  });

  it("summarizes enabled delivery rules", () => {
    const preferences = {
      ...defaultUserPreferences,
      notificationChannels: {
        push: false,
        emailDigest: true,
        criticalOnly: true
      },
      quietHoursEnabled: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "06:30"
    };

    expect(countEnabledNotificationRules(preferences.notificationRules)).toBe(3);
    expect(getNotificationDeliverySummary(preferences)).toEqual([
      "邮件摘要",
      "仅关键事件",
      "安静时段 23:00-06:30"
    ]);
  });
});

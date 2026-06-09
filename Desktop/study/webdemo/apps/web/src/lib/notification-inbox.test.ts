import { describe, expect, it } from "vitest";
import {
  createNotificationInboxViewState,
  createNotificationInboxItem,
  defaultNotificationInboxAdvancedFilters,
  getNotificationInboxDeviceOptions,
  getNotificationInboxSummary,
  getVisibleNotificationInboxItems,
  hasActiveNotificationInboxAdvancedFilters,
  markAllNotificationInboxItemsRead,
  markNotificationInboxItem,
  mergeNotificationInboxItems,
  parseNotificationInbox,
  parseNotificationInboxView,
  removeArchivedNotificationInboxItems,
  seedNotificationInboxItems,
  serializeNotificationInbox,
  serializeNotificationInboxView
} from "./notification-inbox";
import { defaultUserPreferences } from "./user-preferences";

describe("notification inbox helpers", () => {
  it("falls back to seed inbox items for empty or invalid storage", () => {
    expect(parseNotificationInbox(null)).toEqual(seedNotificationInboxItems);
    expect(parseNotificationInbox("not-json")).toEqual(seedNotificationInboxItems);
  });

  it("serializes and normalizes inbox records defensively", () => {
    const item = createNotificationInboxItem(
      {
        id: "notice-test",
        title: "测试通知",
        message: "通知内容",
        source: "push",
        priority: "normal",
        ruleKey: "commandResults",
        deliveryTarget: "应用内"
      },
      new Date("2026-06-07T09:00:00.000Z")
    );

    const parsed = parseNotificationInbox(serializeNotificationInbox([item]));

    expect(parsed).toEqual([
      {
        ...item,
        timestamp: "2026-06-07T09:00:00.000Z",
        state: "unread"
      }
    ]);
  });

  it("serializes and normalizes saved inbox views defensively", () => {
    const view = createNotificationInboxViewState(
      "unread",
      {
        query: "空气",
        deviceId: "device-sensor-02",
        priority: "warning",
        source: "device"
      },
      new Date("2026-06-07T10:00:00.000Z")
    );

    expect(parseNotificationInboxView(serializeNotificationInboxView(view))).toEqual(view);
    expect(parseNotificationInboxView("not-json")).toBeNull();
    expect(parseNotificationInboxView(JSON.stringify({ ...view, schemaVersion: 2 }))).toBeNull();

    expect(
      parseNotificationInboxView(
        JSON.stringify({
          schemaVersion: 1,
          filter: "unknown",
          advancedFilters: {
            query: 123,
            deviceId: "",
            priority: "urgent",
            source: "unknown"
          },
          savedAt: "2026-06-07T10:00:00.000Z"
        })
      )
    ).toEqual({
      schemaVersion: 1,
      filter: "all",
      advancedFilters: defaultNotificationInboxAdvancedFilters,
      savedAt: "2026-06-07T10:00:00.000Z"
    });

    expect(hasActiveNotificationInboxAdvancedFilters(defaultNotificationInboxAdvancedFilters)).toBe(false);
    expect(hasActiveNotificationInboxAdvancedFilters({ ...defaultNotificationInboxAdvancedFilters, query: "空气" }))
      .toBe(true);
  });

  it("filters visible items by notification rules and critical-only preference", () => {
    const preferences = {
      ...defaultUserPreferences,
      notificationChannels: {
        ...defaultUserPreferences.notificationChannels,
        criticalOnly: true
      },
      notificationRules: {
        ...defaultUserPreferences.notificationRules,
        offlineAlerts: true,
        telemetryWarnings: true,
        commandResults: true,
        weeklySummary: true
      }
    };

    const visible = getVisibleNotificationInboxItems(seedNotificationInboxItems, preferences, "all");

    expect(visible).toHaveLength(1);
    expect(visible[0]).toEqual(expect.objectContaining({ priority: "critical" }));
  });

  it("summarizes unread, critical, delayed, and archived counts", () => {
    const archived = markNotificationInboxItem(seedNotificationInboxItems, "notice-command-result-relay-01", "archived");
    const summary = getNotificationInboxSummary(archived, {
      ...defaultUserPreferences,
      notificationRules: {
        ...defaultUserPreferences.notificationRules,
        weeklySummary: true
      }
    });

    expect(summary).toEqual({
      totalVisible: 3,
      unread: 2,
      criticalUnread: 1,
      delayedByQuietHours: 1,
      archived: 1
    });
  });

  it("applies text, device, priority, source, and device option filters", () => {
    const preferences = {
      ...defaultUserPreferences,
      notificationRules: {
        ...defaultUserPreferences.notificationRules,
        weeklySummary: true
      }
    };

    expect(
      getVisibleNotificationInboxItems(seedNotificationInboxItems, preferences, "all", {
        ...defaultNotificationInboxAdvancedFilters,
        query: "空气"
      }).map((item) => item.id)
    ).toEqual(["notice-air-quality-warning"]);

    expect(
      getVisibleNotificationInboxItems(seedNotificationInboxItems, preferences, "all", {
        ...defaultNotificationInboxAdvancedFilters,
        deviceId: "device-relay-02"
      }).map((item) => item.id)
    ).toEqual(["notice-offline-relay-02"]);

    expect(
      getVisibleNotificationInboxItems(seedNotificationInboxItems, preferences, "all", {
        ...defaultNotificationInboxAdvancedFilters,
        priority: "summary",
        source: "summary"
      }).map((item) => item.id)
    ).toEqual(["notice-weekly-summary"]);

    const deviceOptions = getNotificationInboxDeviceOptions(seedNotificationInboxItems, preferences);

    expect(deviceOptions).toHaveLength(3);
    expect(deviceOptions).toEqual(
      expect.arrayContaining([
        { id: "device-relay-02", name: "排风扇继电器", count: 1 },
        { id: "device-sensor-02", name: "空气质量传感器", count: 1 },
        { id: "device-relay-01", name: "主灯继电器", count: 1 }
      ])
    );
  });

  it("marks items read, archives items, removes archived items, and deduplicates merged notices", () => {
    const nextNotice = createNotificationInboxItem({
      id: "notice-offline-relay-02",
      title: "更新后的离线告警",
      message: "同一个通知 ID 会替换旧版本",
      source: "device",
      priority: "critical",
      ruleKey: "offlineAlerts",
      deliveryTarget: "应用内"
    });
    const merged = mergeNotificationInboxItems(seedNotificationInboxItems, nextNotice);
    const matches = merged.filter((item) => item.id === "notice-offline-relay-02");

    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("更新后的离线告警");

    const readItems = markAllNotificationInboxItemsRead(merged);
    expect(readItems.every((item) => item.state !== "unread")).toBe(true);

    const archivedItems = markNotificationInboxItem(readItems, "notice-offline-relay-02", "archived");
    const visibleArchived = getVisibleNotificationInboxItems(archivedItems, defaultUserPreferences, "archived");

    expect(visibleArchived).toHaveLength(1);
    expect(visibleArchived[0]).toEqual(expect.objectContaining({ id: "notice-offline-relay-02" }));

    expect(removeArchivedNotificationInboxItems(archivedItems).some((item) => item.state === "archived")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  LOCAL_APP_BACKUP_SCHEMA_VERSION,
  applyLocalAppBackupRestorePlan,
  buildLocalAppBackup,
  createLocalAppBackupRestorePlan,
  getLocalAppBackupFilename,
  parseLocalAppBackupText,
  serializeLocalAppBackup
} from "./local-app-backup";
import { ACTIVITY_LOG_VIEW_STORAGE_KEY } from "./activity-logs";
import { DEVICE_FAVORITES_STORAGE_KEY, DEVICE_FILTER_VIEW_STORAGE_KEY } from "./device-list";
import {
  NOTIFICATION_INBOX_STORAGE_KEY,
  NOTIFICATION_INBOX_VIEW_STORAGE_KEY
} from "./notification-inbox";
import {
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY
} from "./push-notifications";
import { SETTINGS_DEVICES_STORAGE_KEY } from "./settings-devices";
import { defaultUserPreferences, USER_PREFERENCES_STORAGE_KEY } from "./user-preferences";

function createStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null
  };
}

function createMutableStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    }
  };
}

describe("local app backup", () => {
  it("collects known local storage entries into a dated backup", () => {
    const backup = buildLocalAppBackup(
      createStorage({
        [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          defaultLanding: "devices"
        })
      }),
      new Date("2026-06-09T03:10:00.000Z")
    );

    expect(backup).toEqual(
      expect.objectContaining({
        schemaVersion: LOCAL_APP_BACKUP_SCHEMA_VERSION,
        app: "smart-home-web",
        generatedAt: "2026-06-09T03:10:00.000Z"
      })
    );
    expect(backup.summary.totalCount).toBeGreaterThanOrEqual(8);
    expect(backup.summary.presentCount).toBe(1);
    expect(backup.entries.find((entry) => entry.key === USER_PREFERENCES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        present: true,
        label: "本机偏好",
        value: expect.objectContaining({ defaultLanding: "devices" })
      })
    );
    expect(getLocalAppBackupFilename(new Date("2026-06-09T03:10:00.000Z"))).toBe(
      "smart-home-local-state-2026-06-09.json"
    );
  });

  it("redacts push subscription endpoint and key material", () => {
    const backup = buildLocalAppBackup(
      createStorage({
        [PUSH_SUBSCRIPTION_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          endpoint: "https://push.example/subscriptions/super-secret-endpoint",
          createdAt: "2026-06-09T01:00:00.000Z",
          expirationTime: null,
          keys: {
            p256dh: "public-key-material",
            auth: "auth-secret-token"
          }
        })
      }),
      new Date("2026-06-09T03:10:00.000Z")
    );

    const pushEntry = backup.entries.find((entry) => entry.key === PUSH_SUBSCRIPTION_STORAGE_KEY);
    const serialized = serializeLocalAppBackup(backup);

    expect(pushEntry).toEqual(
      expect.objectContaining({
        present: true,
        redacted: true,
        value: expect.objectContaining({
          endpointFingerprint: expect.stringMatching(/^psh-/),
          hasP256dhKey: true,
          hasAuthKey: true
        })
      })
    );
    expect(serialized).not.toContain("https://push.example/subscriptions/super-secret-endpoint");
    expect(serialized).not.toContain("public-key-material");
    expect(serialized).not.toContain("auth-secret-token");
  });

  it("parses backup text and restores only non-redacted present entries", () => {
    const backup = buildLocalAppBackup(
      createStorage({
        [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          defaultLanding: "devices",
          dashboardDensity: "compact"
        }),
        [DEVICE_FAVORITES_STORAGE_KEY]: JSON.stringify(["device-relay-01"]),
        [PUSH_SUBSCRIPTION_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          endpoint: "https://push.example/subscriptions/restore-secret",
          createdAt: "2026-06-09T01:00:00.000Z",
          expirationTime: null,
          keys: {
            p256dh: "restore-public-key",
            auth: "restore-auth-secret"
          }
        })
      }),
      new Date("2026-06-09T03:10:00.000Z")
    );
    const parsedBackup = parseLocalAppBackupText(serializeLocalAppBackup(backup));
    const storage = createMutableStorage({
      [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        defaultLanding: "settings"
      }),
      [PUSH_SUBSCRIPTION_STORAGE_KEY]: "existing-subscription-record"
    });

    expect(parsedBackup).not.toBeNull();
    const plan = createLocalAppBackupRestorePlan(storage, parsedBackup!);

    expect(plan.summary).toEqual(
      expect.objectContaining({
        restorableCount: 2,
        overwriteCount: 1,
        skippedCount: expect.any(Number)
      })
    );
    expect(plan.items.find((item) => item.key === USER_PREFERENCES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        status: "overwrite",
        reason: "将覆盖当前本机状态"
      })
    );
    expect(plan.items.find((item) => item.key === PUSH_SUBSCRIPTION_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        status: "redacted",
        restoreValue: null
      })
    );

    expect(applyLocalAppBackupRestorePlan(storage, plan)).toBe(2);
    expect(JSON.parse(storage.getItem(USER_PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        defaultLanding: "devices",
        dashboardDensity: "compact"
      })
    );
    expect(JSON.parse(storage.getItem(DEVICE_FAVORITES_STORAGE_KEY) ?? "[]")).toEqual(["device-relay-01"]);
    expect(storage.getItem(PUSH_SUBSCRIPTION_STORAGE_KEY)).toBe("existing-subscription-record");
  });

  it("includes settings device maintenance state in backup and restore", () => {
    const deviceState = {
      schemaVersion: 1,
      updatedAt: "2026-06-09T08:00:00.000Z",
      devices: [
        {
          id: "device-relay-01",
          name: "主灯继电器 Pro",
          type: "relay-controller",
          room: "书房",
          home: "温馨公寓",
          online: true,
          lastSeen: "2026-06-09T08:00:00.000Z",
          firmware: "v1.2.3",
          ip: "192.168.1.101",
          mac: "AA:BB:CC:DD:EE:01"
        }
      ]
    };
    const backup = buildLocalAppBackup(
      createStorage({
        [SETTINGS_DEVICES_STORAGE_KEY]: JSON.stringify(deviceState)
      }),
      new Date("2026-06-09T08:05:00.000Z")
    );
    const storage = createMutableStorage({});
    const plan = createLocalAppBackupRestorePlan(storage, backup);

    expect(backup.entries.find((entry) => entry.key === SETTINGS_DEVICES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        label: "设备维护状态",
        present: true,
        value: expect.objectContaining({
          devices: [expect.objectContaining({ name: "主灯继电器 Pro", room: "书房" })]
        })
      })
    );
    expect(plan.items.find((item) => item.key === SETTINGS_DEVICES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        status: "restore",
        restoreValue: JSON.stringify(deviceState)
      })
    );

    expect(applyLocalAppBackupRestorePlan(storage, plan)).toBe(1);
    expect(JSON.parse(storage.getItem(SETTINGS_DEVICES_STORAGE_KEY) ?? "{}")).toEqual(deviceState);
  });

  it("rejects invalid settings device maintenance restore values", () => {
    const currentDeviceState = JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-06-09T07:00:00.000Z",
      devices: [
        {
          id: "device-relay-01",
          name: "当前设备",
          type: "relay-controller",
          room: "客厅",
          home: "温馨公寓",
          online: true,
          lastSeen: "2026-06-09T07:00:00.000Z",
          firmware: "v1.2.3",
          ip: "192.168.1.101",
          mac: "AA:BB:CC:DD:EE:01"
        }
      ]
    });
    const backup = buildLocalAppBackup(
      createStorage({
        [SETTINGS_DEVICES_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          updatedAt: "2026-06-09T08:00:00.000Z",
          devices: [{ id: "", name: "bad", type: "relay-controller" }]
        })
      }),
      new Date("2026-06-09T08:05:00.000Z")
    );
    const storage = createMutableStorage({
      [SETTINGS_DEVICES_STORAGE_KEY]: currentDeviceState
    });
    const plan = createLocalAppBackupRestorePlan(storage, backup);

    expect(plan.items.find((item) => item.key === SETTINGS_DEVICES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        status: "invalid",
        reason: "备份中的设备维护状态不符合当前 schema，已跳过",
        restoreValue: null
      })
    );
    expect(applyLocalAppBackupRestorePlan(storage, plan)).toBe(0);
    expect(storage.getItem(SETTINGS_DEVICES_STORAGE_KEY)).toBe(currentDeviceState);
  });

  it("normalizes known local state values before restoring them", () => {
    const backup = buildLocalAppBackup(
      createStorage({
        [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          dashboardDensity: "compact",
          defaultLanding: "activity",
          quietHoursStart: "25:99",
          notificationChannels: {
            push: false,
            emailDigest: true
          }
        }),
        [DEVICE_FAVORITES_STORAGE_KEY]: JSON.stringify([
          "device-relay-03",
          "device-relay-01",
          "device-relay-03"
        ]),
        [DEVICE_FILTER_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          filters: {
            searchQuery: 42,
            filterType: "",
            filterStatus: "online",
            favoriteOnly: true
          },
          savedAt: "2026-06-09T09:00:00.000Z"
        }),
        [ACTIVITY_LOG_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          filters: {
            query: "排风扇",
            type: "unknown",
            level: "warning"
          },
          savedAt: "2026-06-09T09:05:00.000Z"
        }),
        [NOTIFICATION_INBOX_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          items: [
            {
              schemaVersion: 1,
              id: "notice-restore-test",
              title: "恢复测试",
              message: "有效通知应恢复",
              timestamp: "2026-06-09T09:10:00.000Z",
              source: "push",
              priority: "normal",
              state: "unread",
              ruleKey: "commandResults",
              deliveryTarget: "应用内"
            }
          ]
        }),
        [NOTIFICATION_INBOX_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          filter: "unknown",
          advancedFilters: {
            query: "空气",
            deviceId: "device-sensor-02",
            priority: "urgent",
            source: "device"
          },
          savedAt: "2026-06-09T09:15:00.000Z"
        }),
        [PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          endpointFingerprint: "psh-abc123-endpoint",
          syncedAt: "2026-06-09T09:20:00.000Z",
          syncTarget: "backend-placeholder"
        })
      }),
      new Date("2026-06-09T09:30:00.000Z")
    );
    const storage = createMutableStorage({});
    const plan = createLocalAppBackupRestorePlan(storage, backup);

    expect(plan.summary.restorableCount).toBe(7);
    expect(applyLocalAppBackupRestorePlan(storage, plan)).toBe(7);

    expect(JSON.parse(storage.getItem(USER_PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        dashboardDensity: "compact",
        defaultLanding: "activity",
        quietHoursStart: defaultUserPreferences.quietHoursStart,
        notificationChannels: expect.objectContaining({
          push: false,
          emailDigest: true
        })
      })
    );
    expect(JSON.parse(storage.getItem(DEVICE_FAVORITES_STORAGE_KEY) ?? "[]")).toEqual([
      "device-relay-01",
      "device-relay-03"
    ]);
    expect(JSON.parse(storage.getItem(DEVICE_FILTER_VIEW_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        filters: expect.objectContaining({
          searchQuery: "",
          filterStatus: "online",
          favoriteOnly: true
        })
      })
    );
    expect(JSON.parse(storage.getItem(ACTIVITY_LOG_VIEW_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        filters: expect.objectContaining({
          query: "排风扇",
          type: "all",
          level: "warning"
        })
      })
    );
    expect(JSON.parse(storage.getItem(NOTIFICATION_INBOX_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        items: [expect.objectContaining({ id: "notice-restore-test" })]
      })
    );
    expect(JSON.parse(storage.getItem(NOTIFICATION_INBOX_VIEW_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        filter: "all",
        advancedFilters: expect.objectContaining({
          query: "空气",
          deviceId: "device-sensor-02",
          priority: "all",
          source: "device"
        })
      })
    );
    expect(JSON.parse(storage.getItem(PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        endpointFingerprint: "psh-abc123-endpoint",
        syncTarget: "backend-placeholder"
      })
    );
  });

  it("rejects invalid known local state restore values without overwriting current storage", () => {
    const backup = buildLocalAppBackup(
      createStorage({
        [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 2,
          defaultLanding: "devices"
        }),
        [DEVICE_FAVORITES_STORAGE_KEY]: JSON.stringify(["device-relay-01", 42]),
        [DEVICE_FILTER_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          filters: {},
          savedAt: "not-a-date"
        }),
        [ACTIVITY_LOG_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 2,
          filters: {},
          savedAt: "2026-06-09T09:00:00.000Z"
        }),
        [NOTIFICATION_INBOX_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          items: [{ schemaVersion: 1, id: "broken-notice" }]
        }),
        [NOTIFICATION_INBOX_VIEW_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          filter: "unread",
          advancedFilters: {},
          savedAt: "not-a-date"
        }),
        [PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY]: JSON.stringify({
          schemaVersion: 1,
          endpointFingerprint: "psh-invalid",
          syncedAt: "2026-06-09T09:20:00.000Z",
          syncTarget: "wrong-target"
        })
      }),
      new Date("2026-06-09T09:30:00.000Z")
    );
    const currentValues = {
      [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, defaultLanding: "settings" }),
      [DEVICE_FAVORITES_STORAGE_KEY]: JSON.stringify(["device-relay-02"]),
      [DEVICE_FILTER_VIEW_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        filters: {},
        savedAt: "2026-06-09T08:00:00.000Z"
      }),
      [ACTIVITY_LOG_VIEW_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        filters: {},
        savedAt: "2026-06-09T08:05:00.000Z"
      }),
      [NOTIFICATION_INBOX_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, items: [] }),
      [NOTIFICATION_INBOX_VIEW_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        filter: "all",
        advancedFilters: {},
        savedAt: "2026-06-09T08:10:00.000Z"
      }),
      [PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        endpointFingerprint: "psh-current-endpoint",
        syncedAt: "2026-06-09T08:15:00.000Z",
        syncTarget: "backend-placeholder"
      })
    };
    const storage = createMutableStorage({ ...currentValues });
    const plan = createLocalAppBackupRestorePlan(storage, backup);

    expect(plan.items.filter((item) => item.status === "invalid").map((item) => item.key)).toEqual([
      USER_PREFERENCES_STORAGE_KEY,
      DEVICE_FAVORITES_STORAGE_KEY,
      DEVICE_FILTER_VIEW_STORAGE_KEY,
      ACTIVITY_LOG_VIEW_STORAGE_KEY,
      NOTIFICATION_INBOX_STORAGE_KEY,
      NOTIFICATION_INBOX_VIEW_STORAGE_KEY,
      PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY
    ]);
    expect(applyLocalAppBackupRestorePlan(storage, plan)).toBe(0);

    for (const [key, value] of Object.entries(currentValues)) {
      expect(storage.getItem(key)).toBe(value);
    }
  });

  it("rejects malformed backup text and skips parse-error values", () => {
    expect(parseLocalAppBackupText("not json")).toBeNull();
    expect(parseLocalAppBackupText(JSON.stringify({ schemaVersion: 999, entries: [] }))).toBeNull();

    const backup = buildLocalAppBackup(
      createStorage({
        [USER_PREFERENCES_STORAGE_KEY]: "{bad-json"
      }),
      new Date("2026-06-09T03:10:00.000Z")
    );
    const plan = createLocalAppBackupRestorePlan(createMutableStorage({}), backup);

    expect(plan.items.find((item) => item.key === USER_PREFERENCES_STORAGE_KEY)).toEqual(
      expect.objectContaining({
        status: "invalid",
        restoreValue: null
      })
    );
  });
});

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
import { DEVICE_FAVORITES_STORAGE_KEY } from "./device-list";
import { PUSH_SUBSCRIPTION_STORAGE_KEY } from "./push-notifications";
import { SETTINGS_DEVICES_STORAGE_KEY } from "./settings-devices";
import { USER_PREFERENCES_STORAGE_KEY } from "./user-preferences";

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

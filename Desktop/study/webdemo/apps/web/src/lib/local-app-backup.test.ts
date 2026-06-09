import { describe, expect, it } from "vitest";
import {
  LOCAL_APP_BACKUP_SCHEMA_VERSION,
  buildLocalAppBackup,
  getLocalAppBackupFilename,
  serializeLocalAppBackup
} from "./local-app-backup";
import { PUSH_SUBSCRIPTION_STORAGE_KEY } from "./push-notifications";
import { USER_PREFERENCES_STORAGE_KEY } from "./user-preferences";

function createStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null
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
});

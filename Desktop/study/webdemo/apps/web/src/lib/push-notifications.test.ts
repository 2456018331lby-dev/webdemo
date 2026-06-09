import { describe, expect, it } from "vitest";
import {
  buildPushReadiness,
  buildPushSubscriptionSyncHealth,
  createPushSubscriptionRecord,
  createPushSubscriptionSyncRecord,
  getPushEndpointFingerprint,
  parsePushSubscriptionRecord,
  parsePushSubscriptionSyncRecord,
  serializePushSubscriptionRecord,
  serializePushSubscriptionSyncRecord,
  urlBase64ToUint8Array,
  type PushCapabilitySnapshot
} from "./push-notifications";

const readySnapshot: PushCapabilitySnapshot = {
  notificationSupported: true,
  serviceWorkerSupported: true,
  pushManagerSupported: true,
  permission: "granted",
  hasVapidPublicKey: true,
  hasSubscription: false
};

describe("push notification helpers", () => {
  it("reports unsupported browser capabilities", () => {
    const readiness = buildPushReadiness({
      ...readySnapshot,
      notificationSupported: false,
      serviceWorkerSupported: false,
      permission: "unsupported"
    });

    expect(readiness.status).toBe("unsupported");
    expect(readiness.tone).toBe("danger");
    expect(readiness.blockers).toEqual(
      expect.arrayContaining(["浏览器通知 API 不可用", "Service Worker 不可用"])
    );
  });

  it("routes permission and subscription states to the right action", () => {
    expect(buildPushReadiness({ ...readySnapshot, permission: "default" })).toEqual(
      expect.objectContaining({
        status: "needs-permission",
        primaryAction: "request-permission"
      })
    );
    expect(buildPushReadiness({ ...readySnapshot, permission: "denied" })).toEqual(
      expect.objectContaining({
        status: "permission-denied",
        primaryAction: "none"
      })
    );
    expect(buildPushReadiness({ ...readySnapshot, hasVapidPublicKey: false })).toEqual(
      expect.objectContaining({
        status: "waiting-for-vapid",
        primaryAction: "none"
      })
    );
    expect(buildPushReadiness(readySnapshot)).toEqual(
      expect.objectContaining({
        status: "ready-to-subscribe",
        primaryAction: "subscribe"
      })
    );
    expect(buildPushReadiness({ ...readySnapshot, hasSubscription: true })).toEqual(
      expect.objectContaining({
        status: "subscribed",
        tone: "success"
      })
    );
  });

  it("creates, serializes, and parses subscription records defensively", () => {
    const record = createPushSubscriptionRecord(
      {
        endpoint: "https://push.example/subscription",
        expirationTime: Date.UTC(2026, 5, 7),
        keys: {
          p256dh: "public-key",
          auth: "auth-secret"
        }
      },
      new Date("2026-06-07T08:00:00.000Z")
    );

    expect(record).toEqual({
      schemaVersion: 1,
      endpoint: "https://push.example/subscription",
      createdAt: "2026-06-07T08:00:00.000Z",
      expirationTime: "2026-06-07T00:00:00.000Z",
      keys: {
        p256dh: "public-key",
        auth: "auth-secret"
      }
    });
    expect(parsePushSubscriptionRecord(serializePushSubscriptionRecord(record!))).toEqual(record);
    expect(parsePushSubscriptionRecord("not-json")).toBeNull();
    expect(createPushSubscriptionRecord({ endpoint: "" })).toBeNull();
  });

  it("converts VAPID base64url public keys into bytes", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID-_8"))).toEqual([1, 2, 3, 251, 255]);
  });

  it("builds subscription sync health for missing, unsynced, changed, stale, and expired endpoints", () => {
    const now = new Date("2026-06-07T12:00:00.000Z");
    const freshRecord = createPushSubscriptionRecord(
      {
        endpoint: "https://push.example/fresh-endpoint",
        keys: { auth: "auth" }
      },
      new Date("2026-06-01T12:00:00.000Z")
    )!;
    const staleRecord = createPushSubscriptionRecord(
      {
        endpoint: "https://push.example/stale-endpoint",
        keys: { auth: "auth" }
      },
      new Date("2026-04-01T12:00:00.000Z")
    )!;
    const expiredRecord = createPushSubscriptionRecord(
      {
        endpoint: "https://push.example/expired-endpoint",
        expirationTime: Date.parse("2026-06-01T12:00:00.000Z"),
        keys: { auth: "auth" }
      },
      new Date("2026-06-01T12:00:00.000Z")
    )!;
    const syncedRecord = createPushSubscriptionSyncRecord(freshRecord, new Date("2026-06-07T10:00:00.000Z"));
    const changedRecord = {
      ...syncedRecord,
      endpointFingerprint: getPushEndpointFingerprint("https://push.example/old-endpoint")
    };

    expect(buildPushSubscriptionSyncHealth(null, null, now)).toEqual(
      expect.objectContaining({ status: "missing-subscription", primaryAction: "none" })
    );
    expect(buildPushSubscriptionSyncHealth(freshRecord, null, now)).toEqual(
      expect.objectContaining({ status: "not-synced", primaryAction: "record-sync" })
    );
    expect(buildPushSubscriptionSyncHealth(freshRecord, syncedRecord, now)).toEqual(
      expect.objectContaining({ status: "synced", tone: "success" })
    );
    expect(buildPushSubscriptionSyncHealth(freshRecord, changedRecord, now)).toEqual(
      expect.objectContaining({ status: "endpoint-changed", primaryAction: "record-sync" })
    );
    expect(buildPushSubscriptionSyncHealth(staleRecord, null, now)).toEqual(
      expect.objectContaining({ status: "stale", primaryAction: "resubscribe" })
    );
    expect(buildPushSubscriptionSyncHealth(expiredRecord, null, now)).toEqual(
      expect.objectContaining({ status: "expired", tone: "danger" })
    );
  });

  it("serializes and parses subscription sync records defensively", () => {
    const record = createPushSubscriptionRecord(
      { endpoint: "https://push.example/sync", keys: { auth: "auth" } },
      new Date("2026-06-07T08:00:00.000Z")
    )!;
    const syncRecord = createPushSubscriptionSyncRecord(record, new Date("2026-06-07T09:00:00.000Z"));

    expect(parsePushSubscriptionSyncRecord(serializePushSubscriptionSyncRecord(syncRecord))).toEqual(syncRecord);
    expect(parsePushSubscriptionSyncRecord("not-json")).toBeNull();
    expect(parsePushSubscriptionSyncRecord(JSON.stringify({ ...syncRecord, schemaVersion: 2 }))).toBeNull();
  });
});

export const PUSH_SUBSCRIPTION_STORAGE_KEY = "smart-home-push-subscription-v1";
export const PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY = "smart-home-push-subscription-sync-v1";

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";
export type PushReadinessStatus =
  | "unsupported"
  | "needs-permission"
  | "permission-denied"
  | "ready-to-subscribe"
  | "waiting-for-vapid"
  | "subscribed";

export type PushCapabilitySnapshot = {
  notificationSupported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  permission: PushPermissionState;
  hasVapidPublicKey: boolean;
  hasSubscription: boolean;
};

export type PushReadiness = {
  status: PushReadinessStatus;
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  primaryAction: "request-permission" | "subscribe" | "none";
  blockers: string[];
};

export type PushSubscriptionRecord = {
  schemaVersion: 1;
  endpoint: string;
  createdAt: string;
  expirationTime: string | null;
  keys: {
    p256dh?: string;
    auth?: string;
  };
};

export type BrowserPushSubscriptionLike = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: unknown;
};

export type PushSubscriptionSyncRecord = {
  schemaVersion: 1;
  endpointFingerprint: string;
  syncedAt: string;
  syncTarget: "backend-placeholder";
};

export type PushSubscriptionSyncStatus =
  | "missing-subscription"
  | "not-synced"
  | "endpoint-changed"
  | "expired"
  | "stale"
  | "synced";

export type PushSubscriptionSyncHealth = {
  status: PushSubscriptionSyncStatus;
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  primaryAction: "record-sync" | "resubscribe" | "none";
  blockers: string[];
  endpointFingerprint: string | null;
  subscriptionAgeDays: number | null;
  expiresAt: string | null;
  lastSyncedAt: string | null;
};

const staleSubscriptionDays = 30;

export function buildPushReadiness(snapshot: PushCapabilitySnapshot): PushReadiness {
  const unsupported = getUnsupportedBlockers(snapshot);

  if (unsupported.length > 0) {
    return {
      status: "unsupported",
      tone: "danger",
      title: "当前浏览器不支持完整推送",
      description: "需要浏览器通知、Service Worker 和 PushManager 同时可用。",
      primaryAction: "none",
      blockers: unsupported
    };
  }

  if (snapshot.permission === "denied") {
    return {
      status: "permission-denied",
      tone: "danger",
      title: "通知权限已被拒绝",
      description: "需要在浏览器站点设置中重新允许通知后才能接收推送。",
      primaryAction: "none",
      blockers: ["浏览器通知权限被拒绝"]
    };
  }

  if (snapshot.permission === "default") {
    return {
      status: "needs-permission",
      tone: "warning",
      title: "等待用户授权通知",
      description: "先授权浏览器通知，再创建 PWA 推送订阅。",
      primaryAction: "request-permission",
      blockers: ["尚未授权通知权限"]
    };
  }

  if (snapshot.hasSubscription) {
    return {
      status: "subscribed",
      tone: "success",
      title: "PWA 推送已就绪",
      description: "当前浏览器已有可用订阅，后续可把订阅端点同步到后端。",
      primaryAction: "none",
      blockers: []
    };
  }

  if (!snapshot.hasVapidPublicKey) {
    return {
      status: "waiting-for-vapid",
      tone: "info",
      title: "等待 VAPID 公钥",
      description: "通知权限已具备，还需要配置 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY 才能创建 Web Push 订阅。",
      primaryAction: "none",
      blockers: ["缺少 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY"]
    };
  }

  return {
    status: "ready-to-subscribe",
    tone: "warning",
    title: "可以创建推送订阅",
    description: "浏览器能力和公钥已就绪，可以向 PushManager 申请订阅。",
    primaryAction: "subscribe",
    blockers: []
  };
}

export function parsePushSubscriptionRecord(raw: string | null): PushSubscriptionRecord | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizePushSubscriptionRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parsePushSubscriptionSyncRecord(raw: string | null): PushSubscriptionSyncRecord | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizePushSubscriptionSyncRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializePushSubscriptionRecord(record: PushSubscriptionRecord): string {
  return JSON.stringify(normalizePushSubscriptionRecord(record));
}

export function serializePushSubscriptionSyncRecord(record: PushSubscriptionSyncRecord): string {
  return JSON.stringify(normalizePushSubscriptionSyncRecord(record));
}

export function normalizePushSubscriptionRecord(value: unknown): PushSubscriptionRecord | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.endpoint !== "string") {
    return null;
  }

  return {
    schemaVersion: 1,
    endpoint: value.endpoint,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    expirationTime: typeof value.expirationTime === "string" ? value.expirationTime : null,
    keys: normalizeSubscriptionKeys(value.keys)
  };
}

export function normalizePushSubscriptionSyncRecord(value: unknown): PushSubscriptionSyncRecord | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.endpointFingerprint !== "string" ||
    typeof value.syncedAt !== "string" ||
    value.syncTarget !== "backend-placeholder"
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    endpointFingerprint: value.endpointFingerprint,
    syncedAt: value.syncedAt,
    syncTarget: "backend-placeholder"
  };
}

export function createPushSubscriptionRecord(
  subscription: BrowserPushSubscriptionLike,
  createdAt: Date = new Date()
): PushSubscriptionRecord | null {
  if (typeof subscription.endpoint !== "string" || subscription.endpoint.trim() === "") {
    return null;
  }

  return {
    schemaVersion: 1,
    endpoint: subscription.endpoint,
    createdAt: createdAt.toISOString(),
    expirationTime:
      typeof subscription.expirationTime === "number"
        ? new Date(subscription.expirationTime).toISOString()
        : null,
    keys: normalizeSubscriptionKeys(subscription.keys)
  };
}

export function createPushSubscriptionSyncRecord(
  record: PushSubscriptionRecord,
  syncedAt: Date = new Date()
): PushSubscriptionSyncRecord {
  return {
    schemaVersion: 1,
    endpointFingerprint: getPushEndpointFingerprint(record.endpoint),
    syncedAt: syncedAt.toISOString(),
    syncTarget: "backend-placeholder"
  };
}

export function buildPushSubscriptionSyncHealth(
  subscription: PushSubscriptionRecord | null,
  syncRecord: PushSubscriptionSyncRecord | null,
  now: Date = new Date()
): PushSubscriptionSyncHealth {
  if (!subscription) {
    return {
      status: "missing-subscription",
      tone: "info",
      title: "尚无订阅端点",
      description: "创建 PWA 推送订阅后，才需要同步端点到后端。",
      primaryAction: "none",
      blockers: ["缺少浏览器推送订阅"],
      endpointFingerprint: null,
      subscriptionAgeDays: null,
      expiresAt: null,
      lastSyncedAt: null
    };
  }

  const endpointFingerprint = getPushEndpointFingerprint(subscription.endpoint);
  const subscriptionAgeDays = getAgeDays(subscription.createdAt, now);
  const expiresAt = subscription.expirationTime;
  const isExpired = expiresAt ? getDateMs(expiresAt) <= now.getTime() : false;
  const lastSyncedAt = syncRecord?.syncedAt ?? null;
  const blockers = [];

  if (isExpired) {
    blockers.push("推送订阅已过期");
  }

  if (subscriptionAgeDays !== null && subscriptionAgeDays >= staleSubscriptionDays) {
    blockers.push(`订阅已超过 ${staleSubscriptionDays} 天`);
  }

  if (!syncRecord) {
    blockers.push("订阅端点尚未同步到后端");
  } else if (syncRecord.endpointFingerprint !== endpointFingerprint) {
    blockers.push("当前端点与上次同步快照不一致");
  }

  if (isExpired) {
    return {
      status: "expired",
      tone: "danger",
      title: "推送订阅已过期",
      description: "浏览器端点已经超过过期时间，需要重新订阅后再同步后端。",
      primaryAction: "resubscribe",
      blockers,
      endpointFingerprint,
      subscriptionAgeDays,
      expiresAt,
      lastSyncedAt
    };
  }

  if (subscriptionAgeDays !== null && subscriptionAgeDays >= staleSubscriptionDays) {
    return {
      status: "stale",
      tone: "warning",
      title: "建议重新订阅",
      description: "订阅端点存在时间较长，建议重新创建订阅以降低推送失效风险。",
      primaryAction: "resubscribe",
      blockers,
      endpointFingerprint,
      subscriptionAgeDays,
      expiresAt,
      lastSyncedAt
    };
  }

  if (!syncRecord) {
    return {
      status: "not-synced",
      tone: "warning",
      title: "端点待同步",
      description: "当前浏览器已有订阅端点，但还没有同步快照。接入后端时需要保存这个端点。",
      primaryAction: "record-sync",
      blockers,
      endpointFingerprint,
      subscriptionAgeDays,
      expiresAt,
      lastSyncedAt
    };
  }

  if (syncRecord.endpointFingerprint !== endpointFingerprint) {
    return {
      status: "endpoint-changed",
      tone: "warning",
      title: "端点已变化",
      description: "浏览器端点和上次同步快照不一致，需要重新同步当前端点。",
      primaryAction: "record-sync",
      blockers,
      endpointFingerprint,
      subscriptionAgeDays,
      expiresAt,
      lastSyncedAt
    };
  }

  return {
    status: "synced",
    tone: "success",
    title: "端点同步快照有效",
    description: "当前端点和上次同步快照一致；后续接入后端后可用真实同步状态替换。",
    primaryAction: "none",
    blockers: [],
    endpointFingerprint,
    subscriptionAgeDays,
    expiresAt,
    lastSyncedAt
  };
}

export function getPushEndpointFingerprint(endpoint: string): string {
  let hash = 0;

  for (let index = 0; index < endpoint.length; index += 1) {
    hash = ((hash << 5) - hash + endpoint.charCodeAt(index)) | 0;
  }

  const hashPart = Math.abs(hash).toString(36).padStart(6, "0").slice(-6);
  const tail = endpoint.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "endpoint";

  return `psh-${hashPart}-${tail}`;
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = globalThis.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

function getAgeDays(timestamp: string, now: Date): number | null {
  const valueMs = getDateMs(timestamp);

  if (Number.isNaN(valueMs)) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - valueMs) / 86400000));
}

function getDateMs(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function getUnsupportedBlockers(snapshot: PushCapabilitySnapshot): string[] {
  const blockers = [];

  if (!snapshot.notificationSupported || snapshot.permission === "unsupported") {
    blockers.push("浏览器通知 API 不可用");
  }

  if (!snapshot.serviceWorkerSupported) {
    blockers.push("Service Worker 不可用");
  }

  if (!snapshot.pushManagerSupported) {
    blockers.push("PushManager 不可用");
  }

  return blockers;
}

function normalizeSubscriptionKeys(value: unknown): PushSubscriptionRecord["keys"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(typeof value.p256dh === "string" ? { p256dh: value.p256dh } : {}),
    ...(typeof value.auth === "string" ? { auth: value.auth } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

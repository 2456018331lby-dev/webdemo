"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  USER_PREFERENCES_STORAGE_KEY,
  countEnabledNotificationRules,
  defaultUserPreferences,
  getNotificationDeliverySummary,
  normalizeUserPreferences,
  parseUserPreferences,
  serializeUserPreferences,
  type DashboardDensity,
  type DefaultLanding,
  type NotificationChannels,
  type NotificationRules,
  type UserPreferences
} from "@/lib/user-preferences";
import {
  NOTIFICATION_INBOX_STORAGE_KEY,
  NOTIFICATION_INBOX_VIEW_STORAGE_KEY,
  createNotificationInboxItem,
  createNotificationInboxViewState,
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
  serializeNotificationInbox,
  serializeNotificationInboxView,
  seedNotificationInboxItems,
  type NotificationInboxAdvancedFilters,
  type NotificationInboxFilter,
  type NotificationInboxItem,
  type NotificationInboxPriority,
  type NotificationInboxPriorityFilter,
  type NotificationInboxSource,
  type NotificationInboxSourceFilter,
  type NotificationInboxState,
  type NotificationInboxViewState
} from "@/lib/notification-inbox";
import {
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY,
  buildPushReadiness,
  buildPushSubscriptionSyncHealth,
  createPushSubscriptionRecord,
  createPushSubscriptionSyncRecord,
  parsePushSubscriptionRecord,
  parsePushSubscriptionSyncRecord,
  serializePushSubscriptionRecord,
  serializePushSubscriptionSyncRecord,
  urlBase64ToUint8Array,
  type PushCapabilitySnapshot,
  type PushPermissionState,
  type PushSubscriptionRecord,
  type PushSubscriptionSyncRecord
} from "@/lib/push-notifications";

type DeviceConfig = {
  id: string;
  name: string;
  type: string;
  room: string;
  home: string;
  online: boolean;
  lastSeen: string;
  firmware: string;
  ip: string;
  mac: string;
};

const seedDevices: DeviceConfig[] = [
  {
    id: "device-relay-01",
    name: "主灯继电器",
    type: "relay-controller",
    room: "客厅",
    home: "温馨公寓",
    online: true,
    lastSeen: "2026-05-28T10:30:00Z",
    firmware: "v1.2.3",
    ip: "192.168.1.101",
    mac: "AA:BB:CC:DD:EE:01"
  },
  {
    id: "device-sensor-01",
    name: "温湿度传感器",
    type: "environment-sensor",
    room: "客厅",
    home: "温馨公寓",
    online: true,
    lastSeen: "2026-05-28T10:29:00Z",
    firmware: "v2.0.1",
    ip: "192.168.1.102",
    mac: "AA:BB:CC:DD:EE:02"
  },
  {
    id: "device-relay-02",
    name: "排风扇继电器",
    type: "relay-controller",
    room: "厨房",
    home: "温馨公寓",
    online: false,
    lastSeen: "2026-05-28T10:28:00Z",
    firmware: "v1.2.3",
    ip: "192.168.1.103",
    mac: "AA:BB:CC:DD:EE:03"
  },
  {
    id: "device-relay-03",
    name: "床头灯继电器",
    type: "relay-controller",
    room: "卧室",
    home: "温馨公寓",
    online: true,
    lastSeen: "2026-05-28T10:25:00Z",
    firmware: "v1.2.3",
    ip: "192.168.1.104",
    mac: "AA:BB:CC:DD:EE:04"
  },
  {
    id: "device-sensor-02",
    name: "空气质量传感器",
    type: "environment-sensor",
    room: "卧室",
    home: "温馨公寓",
    online: true,
    lastSeen: "2026-05-28T10:24:00Z",
    firmware: "v2.0.1",
    ip: "192.168.1.105",
    mac: "AA:BB:CC:DD:EE:05"
  },
  {
    id: "device-relay-04",
    name: "照明继电器",
    type: "relay-controller",
    room: "办公区",
    home: "办公室",
    online: true,
    lastSeen: "2026-05-28T10:20:00Z",
    firmware: "v1.2.3",
    ip: "192.168.2.101",
    mac: "AA:BB:CC:DD:EE:06"
  }
];

const webPushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

const initialPushCapabilities: PushCapabilitySnapshot = {
  notificationSupported: false,
  serviceWorkerSupported: false,
  pushManagerSupported: false,
  permission: "unsupported",
  hasVapidPublicKey: false,
  hasSubscription: false
};

const notificationRuleLabels: Array<{
  key: keyof NotificationRules;
  title: string;
  description: string;
}> = [
  {
    key: "offlineAlerts",
    title: "设备离线告警",
    description: "设备超过心跳窗口未上报时提醒"
  },
  {
    key: "telemetryWarnings",
    title: "遥测异常提醒",
    description: "温度、空气质量、信号强度异常时提醒"
  },
  {
    key: "commandResults",
    title: "命令执行结果",
    description: "继电器控制确认、失败或超时时提醒"
  },
  {
    key: "weeklySummary",
    title: "每周运行摘要",
    description: "汇总设备在线率、告警和控制次数"
  }
];

const notificationChannelLabels: Array<{
  key: keyof NotificationChannels;
  title: string;
  description: string;
}> = [
  {
    key: "push",
    title: "PWA 推送通知",
    description: "适合手机主屏安装后的即时提醒"
  },
  {
    key: "emailDigest",
    title: "邮件摘要",
    description: "适合家庭管理员的低频汇总"
  },
  {
    key: "criticalOnly",
    title: "仅关键事件",
    description: "只推送离线、失败、危险遥测等高优先级事件"
  }
];

function getDeviceIcon(type: string): string {
  switch (type) {
    case "relay-controller": return "💡";
    case "environment-sensor": return "🌡️";
    case "smart-plug": return "🔌";
    case "camera": return "📷";
    case "door-lock": return "🔒";
    default: return "⚙️";
  }
}

function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case "relay-controller": return "继电器";
    case "environment-sensor": return "传感器";
    case "smart-plug": return "智能插座";
    case "camera": return "摄像头";
    case "door-lock": return "门锁";
    default: return type;
  }
}

function formatLastSeen(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function SettingsPage() {
  const [devices, setDevices] = useState<DeviceConfig[]>(seedDevices);
  const [selectedDevice, setSelectedDevice] = useState<DeviceConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", room: "" });
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    type: "relay-controller",
    room: "",
    home: "温馨公寓"
  });
  const [operationResult, setOperationResult] = useState<string | null>(null);
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscription, setPushSubscription] = useState<PushSubscriptionRecord | null>(null);
  const [pushSyncRecord, setPushSyncRecord] = useState<PushSubscriptionSyncRecord | null>(null);
  const [pushCapabilities, setPushCapabilities] = useState<PushCapabilitySnapshot>(initialPushCapabilities);
  const [notificationItems, setNotificationItems] = useState<NotificationInboxItem[]>(seedNotificationInboxItems);
  const [notificationFilter, setNotificationFilter] = useState<NotificationInboxFilter>("all");
  const [notificationAdvancedFilters, setNotificationAdvancedFilters] = useState<NotificationInboxAdvancedFilters>(
    defaultNotificationInboxAdvancedFilters
  );
  const [savedNotificationView, setSavedNotificationView] = useState<NotificationInboxViewState | null>(null);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const hasSkippedInitialPreferenceSave = useRef(false);

  useEffect(() => {
    const restoredNotificationView = parseNotificationInboxView(
      window.localStorage.getItem(NOTIFICATION_INBOX_VIEW_STORAGE_KEY)
    );

    if (restoredNotificationView) {
      setNotificationFilter(restoredNotificationView.filter);
      setNotificationAdvancedFilters(restoredNotificationView.advancedFilters);
      setSavedNotificationView(restoredNotificationView);
    }

    setPreferences(parseUserPreferences(window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY)));
    setNotificationItems(parseNotificationInbox(window.localStorage.getItem(NOTIFICATION_INBOX_STORAGE_KEY)));
    setPreferencesHydrated(true);
    void refreshPushState();
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    if (!hasSkippedInitialPreferenceSave.current) {
      hasSkippedInitialPreferenceSave.current = true;
      return;
    }

    window.localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, serializeUserPreferences(preferences));
    setPreferenceNotice("已自动保存本机偏好");
    const timeoutId = window.setTimeout(() => setPreferenceNotice(null), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [preferences, preferencesHydrated]);

  const onlineCount = devices.filter((device) => device.online).length;
  const notificationRuleCount = countEnabledNotificationRules(preferences.notificationRules);
  const enabledChannelCount = Object.values(preferences.notificationChannels).filter(Boolean).length;
  const deliverySummary = useMemo(() => getNotificationDeliverySummary(preferences), [preferences]);
  const pushReadiness = useMemo(() => buildPushReadiness(pushCapabilities), [pushCapabilities]);
  const pushSyncHealth = useMemo(
    () => buildPushSubscriptionSyncHealth(pushSubscription, pushSyncRecord),
    [pushSubscription, pushSyncRecord]
  );
  const notificationSummary = useMemo(
    () => getNotificationInboxSummary(notificationItems, preferences),
    [notificationItems, preferences]
  );
  const notificationDeviceOptions = useMemo(
    () => getNotificationInboxDeviceOptions(notificationItems, preferences),
    [notificationItems, preferences]
  );
  const visibleNotifications = useMemo(
    () => getVisibleNotificationInboxItems(
      notificationItems,
      preferences,
      notificationFilter,
      notificationAdvancedFilters
    ),
    [notificationAdvancedFilters, notificationItems, notificationFilter, preferences]
  );
  const hasNotificationAdvancedFilters = hasActiveNotificationInboxAdvancedFilters(notificationAdvancedFilters);
  const savedNotificationViewLabel = useMemo(
    () => savedNotificationView ? getSavedNotificationViewLabel(savedNotificationView, notificationDeviceOptions) : null,
    [notificationDeviceOptions, savedNotificationView]
  );
  const activeNotice = operationResult ?? preferenceNotice ?? pushNotice;

  function updatePreferences(updater: (current: UserPreferences) => Partial<UserPreferences>) {
    setPreferences((current) => normalizeUserPreferences({ ...current, ...updater(current) }));
  }

  function updateChannel(key: keyof NotificationChannels, value: boolean) {
    updatePreferences((current) => ({
      notificationChannels: {
        ...current.notificationChannels,
        [key]: value
      }
    }));
  }

  function updateRule(key: keyof NotificationRules, value: boolean) {
    updatePreferences((current) => ({
      notificationRules: {
        ...current.notificationRules,
        [key]: value
      }
    }));
  }

  function resetPreferences() {
    setPreferences(defaultUserPreferences);
  }

  function showOperationResult(message: string, duration = 3000) {
    setOperationResult(message);
    window.setTimeout(() => setOperationResult(null), duration);
  }

  function showPushNotice(message: string, duration = 3000) {
    setPushNotice(message);
    window.setTimeout(() => setPushNotice(null), duration);
  }

  function persistNotificationInbox(nextItems: NotificationInboxItem[]) {
    setNotificationItems(nextItems);
    window.localStorage.setItem(NOTIFICATION_INBOX_STORAGE_KEY, serializeNotificationInbox(nextItems));
  }

  function updateNotificationState(id: string, state: NotificationInboxState) {
    persistNotificationInbox(markNotificationInboxItem(notificationItems, id, state));
  }

  function handleMarkAllNotificationsRead() {
    persistNotificationInbox(markAllNotificationInboxItemsRead(notificationItems));
    showOperationResult("✅ 已将通知收件箱标记为已读");
  }

  function handleClearArchivedNotifications() {
    persistNotificationInbox(removeArchivedNotificationInboxItems(notificationItems));
    setNotificationFilter("all");
    showOperationResult("✅ 已清除已归档通知");
  }

  function appendNotificationItem(item: NotificationInboxItem) {
    persistNotificationInbox(mergeNotificationInboxItems(notificationItems, item));
  }

  function updateNotificationAdvancedFilters(update: Partial<NotificationInboxAdvancedFilters>) {
    setNotificationAdvancedFilters((current) => ({ ...current, ...update }));
  }

  function clearNotificationAdvancedFilters() {
    setNotificationAdvancedFilters(defaultNotificationInboxAdvancedFilters);
  }

  function handleSaveNotificationView() {
    const nextView = createNotificationInboxViewState(notificationFilter, notificationAdvancedFilters);
    window.localStorage.setItem(NOTIFICATION_INBOX_VIEW_STORAGE_KEY, serializeNotificationInboxView(nextView));
    setSavedNotificationView(nextView);
    showOperationResult("✅ 已保存通知筛选视图");
  }

  function handleRestoreNotificationView() {
    if (!savedNotificationView) {
      showOperationResult("没有可恢复的通知筛选视图");
      return;
    }

    setNotificationFilter(savedNotificationView.filter);
    setNotificationAdvancedFilters(savedNotificationView.advancedFilters);
    showOperationResult("✅ 已恢复通知筛选视图");
  }

  function handleClearSavedNotificationView() {
    window.localStorage.removeItem(NOTIFICATION_INBOX_VIEW_STORAGE_KEY);
    setSavedNotificationView(null);
    showOperationResult("已清除保存的通知筛选视图");
  }

  function handleRecordPushSyncSnapshot() {
    if (!pushSubscription) {
      showPushNotice("需要先创建 PWA 推送订阅");
      return;
    }

    const syncRecord = createPushSubscriptionSyncRecord(pushSubscription);
    window.localStorage.setItem(PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY, serializePushSubscriptionSyncRecord(syncRecord));
    setPushSyncRecord(syncRecord);
    showPushNotice("✅ 已记录订阅端点同步快照");
  }

  function handleClearPushSyncSnapshot() {
    window.localStorage.removeItem(PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY);
    setPushSyncRecord(null);
    showPushNotice("已清除订阅端点同步快照");
  }

  async function refreshPushState() {
    const notificationSupported = "Notification" in window;
    const serviceWorkerSupported = "serviceWorker" in navigator;
    const pushManagerSupported = "PushManager" in window;
    const permission: PushPermissionState = notificationSupported ? window.Notification.permission : "unsupported";
    let subscriptionRecord = parsePushSubscriptionRecord(
      window.localStorage.getItem(PUSH_SUBSCRIPTION_STORAGE_KEY)
    );
    const syncRecord = parsePushSubscriptionSyncRecord(
      window.localStorage.getItem(PUSH_SUBSCRIPTION_SYNC_STORAGE_KEY)
    );

    if (serviceWorkerSupported && pushManagerSupported) {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        const browserRecord = subscription
          ? createPushSubscriptionRecord({
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime,
              keys: subscription.toJSON().keys
            })
          : null;

        if (browserRecord) {
          subscriptionRecord = browserRecord;
          window.localStorage.setItem(
            PUSH_SUBSCRIPTION_STORAGE_KEY,
            serializePushSubscriptionRecord(browserRecord)
          );
        }
      } catch {
        // Keep the local cached subscription state when browser lookup fails.
      }
    }

    setPushSubscription(subscriptionRecord);
    setPushSyncRecord(syncRecord);
    setPushCapabilities({
      notificationSupported,
      serviceWorkerSupported,
      pushManagerSupported,
      permission,
      hasVapidPublicKey: webPushPublicKey.trim() !== "",
      hasSubscription: Boolean(subscriptionRecord)
    });
  }

  async function handleRequestPushPermission() {
    if (!("Notification" in window)) {
      showPushNotice("当前浏览器不支持通知权限");
      return;
    }

    setPushBusy(true);
    try {
      const permission = await window.Notification.requestPermission();
      showPushNotice(permission === "granted" ? "✅ 已授权浏览器通知" : "通知权限未授权");
      await refreshPushState();
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSubscribePush() {
    if (webPushPublicKey.trim() === "") {
      showPushNotice("需要先配置 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      showPushNotice("当前浏览器缺少 Service Worker 或 PushManager");
      return;
    }

    setPushBusy(true);
    try {
      if ("Notification" in window && window.Notification.permission !== "granted") {
        const permission = await window.Notification.requestPermission();

        if (permission !== "granted") {
          showPushNotice("通知权限未授权，无法创建推送订阅");
          await refreshPushState();
          return;
        }
      }

      const registration =
        (await navigator.serviceWorker.getRegistration("/")) ||
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(webPushPublicKey)
      });
      const record = createPushSubscriptionRecord({
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: subscription.toJSON().keys
      });

      if (record) {
        window.localStorage.setItem(PUSH_SUBSCRIPTION_STORAGE_KEY, serializePushSubscriptionRecord(record));
        setPushSubscription(record);
        showPushNotice("✅ 已创建 PWA 推送订阅");
      }

      await refreshPushState();
    } catch {
      showPushNotice("创建推送订阅失败，请检查 VAPID 公钥和浏览器权限");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSendLocalNotification() {
    if (!("Notification" in window)) {
      showPushNotice("当前浏览器不支持本地通知");
      return;
    }

    let permission = window.Notification.permission;

    if (permission === "default") {
      permission = await window.Notification.requestPermission();
    }

    if (permission !== "granted") {
      showPushNotice("通知权限未授权，无法发送本地测试通知");
      await refreshPushState();
      return;
    }

    new window.Notification("智能家居测试通知", {
      body: "通知权限可用。真实 Web Push 还需要后端保存订阅端点。",
      icon: "/icon.svg",
      tag: "smart-home-local-test"
    });
    appendNotificationItem(
      createNotificationInboxItem({
        id: `notice-local-test-${Date.now()}`,
        title: "本地测试通知已发送",
        message: "浏览器通知权限可用；真实 Web Push 仍需后端保存订阅端点并执行推送投递。",
        source: "push",
        priority: "normal",
        ruleKey: "commandResults",
        deliveryTarget: "PWA 推送 / 应用内"
      })
    );
    showPushNotice("✅ 已发送本地测试通知");
    await refreshPushState();
  }

  function handleEdit(device: DeviceConfig) {
    setSelectedDevice(device);
    setEditForm({ name: device.name, room: device.room });
    setIsEditing(true);
  }

  function handleSave() {
    if (!selectedDevice || editForm.name.trim() === "" || editForm.room.trim() === "") {
      return;
    }

    const nextName = editForm.name.trim();
    const nextRoom = editForm.room.trim();

    setDevices((current) =>
      current.map((device) =>
        device.id === selectedDevice.id
          ? { ...device, name: nextName, room: nextRoom, lastSeen: new Date().toISOString() }
          : device
      )
    );
    setSelectedDevice((current) =>
      current ? { ...current, name: nextName, room: nextRoom, lastSeen: new Date().toISOString() } : current
    );
    setIsEditing(false);
    showOperationResult(`✅ 已保存 ${nextName} 的配置`);
  }

  function handleAddDevice() {
    const name = newDevice.name.trim();
    const room = newDevice.room.trim();

    if (name === "" || room === "") {
      return;
    }

    const nextIndex = devices.filter((device) => device.id.startsWith("device-custom-")).length + 1;
    const device: DeviceConfig = {
      id: `device-custom-${nextIndex}`,
      name,
      type: newDevice.type,
      room,
      home: newDevice.home,
      online: false,
      lastSeen: new Date().toISOString(),
      firmware: "待安装",
      ip: "待分配",
      mac: "待配对"
    };

    setDevices((current) => [device, ...current]);
    setShowAddDevice(false);
    setNewDevice({ name: "", type: "relay-controller", room: "", home: "温馨公寓" });
    showOperationResult(`✅ 已添加新设备: ${name}`);
  }

  function handleRestart(device: DeviceConfig) {
    showOperationResult(`🔄 正在重启 ${device.name}...`, 1800);
    window.setTimeout(() => {
      setDevices((current) =>
        current.map((item) =>
          item.id === device.id ? { ...item, online: true, lastSeen: new Date().toISOString() } : item
        )
      );
      showOperationResult(`✅ ${device.name} 已重启`);
    }, 1200);
  }

  function handleFactoryReset(device: DeviceConfig) {
    if (window.confirm(`确定要将 ${device.name} 恢复出厂设置吗？这将清除所有配置。`)) {
      showOperationResult(`🔄 正在恢复 ${device.name} 出厂设置...`, 1800);
      window.setTimeout(() => {
        setDevices((current) =>
          current.map((item) =>
            item.id === device.id ? { ...item, online: false, room: "未分配", lastSeen: new Date().toISOString() } : item
          )
        );
        showOperationResult(`✅ ${device.name} 已恢复出厂设置`);
      }, 1200);
    }
  }

  return (
    <div className="page-grid">
      <section className="hero animate-fade-in-up">
        <div className="hero-label">
          <span>⚙️</span>
          <span>系统设置</span>
        </div>
        <h1 className="hero-title">偏好、通知与设备维护</h1>
        <p className="hero-description">
          管理本机操作偏好、告警通知策略和设备维护动作，让控制台更适合日常使用。
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => setShowAddDevice(true)}>
            ➕ 添加新设备
          </button>
          <Link href="/devices" className="btn btn-secondary">
            📱 查看所有设备
          </Link>
        </div>
      </section>

      <section className="stat-grid animate-fade-in-up delay-1">
        <div className="stat-card">
          <div className="stat-label">通知规则</div>
          <div className="stat-value">{notificationRuleCount}</div>
          <div className="stat-change neutral">已启用 / 4</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">通知收件箱</div>
          <div className="stat-value stat-value--warning">{notificationSummary.unread}</div>
          <div className="stat-change neutral">{notificationSummary.criticalUnread} 条关键未读</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">通知渠道</div>
          <div className="stat-value stat-value--success">{enabledChannelCount}</div>
          <div className="stat-change neutral">本机策略</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PWA 推送</div>
          <div className="stat-value stat-value--compact">{getPushStatusLabel(pushReadiness.status)}</div>
          <div className="stat-change neutral">{pushReadiness.title}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">设备维护</div>
          <div className="stat-value">{devices.length}</div>
          <div className="stat-change positive">{onlineCount} 台在线</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">默认入口</div>
          <div className="stat-value stat-value--compact">
            {preferences.defaultLanding === "dashboard" ? "首页" : getLandingLabel(preferences.defaultLanding)}
          </div>
          <div className="stat-change neutral">{preferences.dashboardDensity === "compact" ? "紧凑视图" : "舒展视图"}</div>
        </div>
      </section>

      {activeNotice && (
        <div
          className="settings-alert animate-fade-in-up"
          data-tone={getNoticeTone(activeNotice)}
          role="status"
        >
          <span>{getNoticeIcon(activeNotice)}</span>
          <span>{activeNotice}</span>
        </div>
      )}

      <section className="settings-grid animate-fade-in-up delay-2">
        <div className="card settings-preference-card">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">个人偏好</h2>
              <p className="card-subtitle">本机保存，不影响其他家庭成员。</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={resetPreferences}>
              恢复默认偏好
            </button>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label className="form-label" htmlFor="default-landing">默认入口</label>
              <select
                id="default-landing"
                className="form-control"
                value={preferences.defaultLanding}
                onChange={(event) =>
                  updatePreferences(() => ({ defaultLanding: event.target.value as DefaultLanding }))
                }
              >
                <option value="dashboard">首页</option>
                <option value="homes">全局健康</option>
                <option value="devices">设备列表</option>
                <option value="activity">活动日志</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="dashboard-density">控制台密度</label>
              <select
                id="dashboard-density"
                className="form-control"
                value={preferences.dashboardDensity}
                onChange={(event) =>
                  updatePreferences(() => ({ dashboardDensity: event.target.value as DashboardDensity }))
                }
              >
                <option value="comfortable">舒展</option>
                <option value="compact">紧凑</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="quiet-start">安静时段开始</label>
              <input
                id="quiet-start"
                className="form-control"
                type="time"
                value={preferences.quietHoursStart}
                onChange={(event) => updatePreferences(() => ({ quietHoursStart: event.target.value }))}
                disabled={!preferences.quietHoursEnabled}
              />
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="quiet-end">安静时段结束</label>
              <input
                id="quiet-end"
                className="form-control"
                type="time"
                value={preferences.quietHoursEnd}
                onChange={(event) => updatePreferences(() => ({ quietHoursEnd: event.target.value }))}
                disabled={!preferences.quietHoursEnabled}
              />
            </div>
          </div>

          <label className="settings-toggle settings-toggle--wide">
            <input
              type="checkbox"
              checked={preferences.quietHoursEnabled}
              onChange={(event) => updatePreferences(() => ({ quietHoursEnabled: event.target.checked }))}
            />
            <span>
              <strong>启用安静时段</strong>
              <small>非关键通知会延后展示，关键离线和危险遥测仍保留。</small>
            </span>
          </label>
        </div>

        <div className="card settings-summary-card">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">通知策略预览</h2>
              <p className="card-subtitle">当前规则会如何触达用户。</p>
            </div>
          </div>
          <div className="settings-summary-list">
            {deliverySummary.map((item) => (
              <div key={item} className="settings-summary-pill">
                <span>•</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-grid animate-fade-in-up delay-3">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">通知渠道</h2>
              <p className="card-subtitle">选择本机希望接收的提醒方式。</p>
            </div>
          </div>
          <div className="settings-toggle-list">
            {notificationChannelLabels.map((channel) => (
              <label key={channel.key} className="settings-toggle">
                <input
                  type="checkbox"
                  checked={preferences.notificationChannels[channel.key]}
                  onChange={(event) => updateChannel(channel.key, event.target.checked)}
                />
                <span>
                  <strong>{channel.title}</strong>
                  <small>{channel.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">触发规则</h2>
              <p className="card-subtitle">决定哪些事件会进入通知队列。</p>
            </div>
          </div>
          <div className="settings-toggle-list">
            {notificationRuleLabels.map((rule) => (
              <label key={rule.key} className="settings-toggle">
                <input
                  type="checkbox"
                  checked={preferences.notificationRules[rule.key]}
                  onChange={(event) => updateRule(rule.key, event.target.checked)}
                />
                <span>
                  <strong>{rule.title}</strong>
                  <small>{rule.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card notification-inbox-card animate-fade-in-up delay-4">
        <div className="card-header">
          <div>
            <div className="hero-label notification-inbox-label">
              <span>◌</span>
              <span>通知收件箱</span>
            </div>
            <h2 className="card-title card-title--md">投递历史与待处理提醒</h2>
            <p className="card-subtitle">把策略结果落到可追踪列表，便于后续接入真实 Web Push 和 Supabase 同步。</p>
          </div>
          <div className="notification-inbox-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleMarkAllNotificationsRead}>
              全部标为已读
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearArchivedNotifications}
              disabled={notificationSummary.archived === 0}
            >
              清除归档
            </button>
          </div>
        </div>

        <div className="notification-inbox-metrics">
          <NotificationInboxMetric label="策略内通知" value={notificationSummary.totalVisible} detail="当前规则可见" />
          <NotificationInboxMetric label="未读提醒" value={notificationSummary.unread} detail="需要处理" tone="warning" />
          <NotificationInboxMetric label="关键未读" value={notificationSummary.criticalUnread} detail="优先处理" tone="danger" />
          <NotificationInboxMetric
            label="安静时段延后"
            value={notificationSummary.delayedByQuietHours}
            detail={preferences.quietHoursEnabled ? "非关键未读" : "未启用"}
            tone="info"
          />
        </div>

        <div className="notification-filter-row" role="tablist" aria-label="通知收件箱筛选">
          {(["all", "unread", "critical", "archived"] as NotificationInboxFilter[]).map((filter) => (
            <button
              key={filter}
              className="notification-filter-button"
              data-active={notificationFilter === filter ? "true" : "false"}
              onClick={() => setNotificationFilter(filter)}
              role="tab"
              aria-selected={notificationFilter === filter}
            >
              {getNotificationFilterLabel(filter, notificationSummary)}
            </button>
          ))}
        </div>

        <div className="notification-search-panel">
          <div className="settings-field notification-search-field">
            <label className="form-label" htmlFor="notification-search">搜索通知</label>
            <input
              id="notification-search"
              className="form-control"
              type="search"
              placeholder="搜索标题、消息、设备或投递渠道"
              value={notificationAdvancedFilters.query}
              onChange={(event) => updateNotificationAdvancedFilters({ query: event.target.value })}
            />
          </div>

          <div className="settings-field">
            <label className="form-label" htmlFor="notification-device-filter">按设备</label>
            <select
              id="notification-device-filter"
              className="form-control"
              value={notificationAdvancedFilters.deviceId}
              onChange={(event) => updateNotificationAdvancedFilters({ deviceId: event.target.value })}
            >
              <option value="all">全部设备</option>
              {notificationDeviceOptions.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.count})
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <label className="form-label" htmlFor="notification-priority-filter">按优先级</label>
            <select
              id="notification-priority-filter"
              className="form-control"
              value={notificationAdvancedFilters.priority}
              onChange={(event) =>
                updateNotificationAdvancedFilters({
                  priority: event.target.value as NotificationInboxPriorityFilter
                })
              }
            >
              {(["all", "critical", "warning", "normal", "summary"] as NotificationInboxPriorityFilter[]).map((priority) => (
                <option key={priority} value={priority}>
                  {getNotificationPriorityFilterLabel(priority)}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <label className="form-label" htmlFor="notification-source-filter">按来源</label>
            <select
              id="notification-source-filter"
              className="form-control"
              value={notificationAdvancedFilters.source}
              onChange={(event) =>
                updateNotificationAdvancedFilters({
                  source: event.target.value as NotificationInboxSourceFilter
                })
              }
            >
              {(["all", "device", "push", "summary", "system"] as NotificationInboxSourceFilter[]).map((source) => (
                <option key={source} value={source}>
                  {getNotificationSourceFilterLabel(source)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-ghost btn-sm notification-filter-clear"
            onClick={clearNotificationAdvancedFilters}
            disabled={!hasNotificationAdvancedFilters}
          >
            清除筛选
          </button>
        </div>

        <div className="notification-view-bar">
          <span>{savedNotificationViewLabel ?? "未保存通知筛选视图"}</span>
          <div className="notification-view-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleSaveNotificationView}>
              保存当前视图
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleRestoreNotificationView}
              disabled={!savedNotificationView}
            >
              恢复视图
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearSavedNotificationView}
              disabled={!savedNotificationView}
            >
              清除保存
            </button>
          </div>
        </div>

        <div className="notification-result-caption" aria-live="polite">
          当前显示 {visibleNotifications.length} 条通知
          {hasNotificationAdvancedFilters ? "，已应用搜索条件" : "，未使用高级筛选"}
        </div>

        {visibleNotifications.length > 0 ? (
          <div className="notification-inbox-list">
            {visibleNotifications.map((item) => (
              <NotificationInboxCard
                key={item.id}
                item={item}
                onChangeState={updateNotificationState}
              />
            ))}
          </div>
        ) : (
          <div className="notification-inbox-empty">
            <strong>当前筛选下没有通知</strong>
            <span>调整通知规则、筛选条件，或发送本地测试通知后会在这里出现记录。</span>
          </div>
        )}
      </section>

      <section className="card push-readiness-card animate-fade-in-up delay-4">
        <div className="push-readiness-head">
          <div>
            <div className="hero-label push-readiness-label">
              <span>🔔</span>
              <span>PWA 推送接入</span>
            </div>
            <h2 className="card-title card-title--md">{pushReadiness.title}</h2>
            <p className="card-subtitle">{pushReadiness.description}</p>
          </div>
          <div className="push-status-orb" data-tone={pushReadiness.tone}>
            {getPushStatusLabel(pushReadiness.status)}
          </div>
        </div>

        <div className="push-check-grid">
          <PushCheckItem
            label="浏览器通知"
            active={pushCapabilities.notificationSupported}
            detail={pushCapabilities.permission === "unsupported" ? "不可用" : getPermissionLabel(pushCapabilities.permission)}
          />
          <PushCheckItem
            label="Service Worker"
            active={pushCapabilities.serviceWorkerSupported}
            detail={pushCapabilities.serviceWorkerSupported ? "可注册" : "不可用"}
          />
          <PushCheckItem
            label="PushManager"
            active={pushCapabilities.pushManagerSupported}
            detail={pushCapabilities.pushManagerSupported ? "可订阅" : "不可用"}
          />
          <PushCheckItem
            label="VAPID 公钥"
            active={pushCapabilities.hasVapidPublicKey}
            detail={pushCapabilities.hasVapidPublicKey ? "已配置" : "待配置"}
          />
        </div>

        {pushReadiness.blockers.length > 0 && (
          <div className="push-blocker-list">
            {pushReadiness.blockers.map((blocker) => (
              <span key={blocker}>{blocker}</span>
            ))}
          </div>
        )}

        {pushSubscription && (
          <div className="push-subscription-box">
            <span>当前订阅端点</span>
            <strong>{pushSubscription.endpoint}</strong>
          </div>
        )}

        <div className="push-sync-panel" data-tone={pushSyncHealth.tone}>
          <div className="push-sync-head">
            <div>
              <h3>订阅同步状态</h3>
              <strong className="push-sync-title">{pushSyncHealth.title}</strong>
              <p>{pushSyncHealth.description}</p>
            </div>
            <span>{getPushSyncStatusLabel(pushSyncHealth.status)}</span>
          </div>

          <div className="push-sync-grid">
            <PushSyncDetail label="端点指纹" value={pushSyncHealth.endpointFingerprint ?? "尚无端点"} monospace />
            <PushSyncDetail
              label="订阅年龄"
              value={pushSyncHealth.subscriptionAgeDays === null ? "未知" : `${pushSyncHealth.subscriptionAgeDays} 天`}
            />
            <PushSyncDetail label="过期时间" value={formatPushSyncDate(pushSyncHealth.expiresAt)} />
            <PushSyncDetail label="上次同步" value={formatPushSyncDate(pushSyncHealth.lastSyncedAt)} />
          </div>

          {pushSyncHealth.blockers.length > 0 && (
            <div className="push-blocker-list push-blocker-list--sync">
              {pushSyncHealth.blockers.map((blocker) => (
                <span key={blocker}>{blocker}</span>
              ))}
              {pushSyncHealth.primaryAction === "resubscribe" && webPushPublicKey.trim() === "" && (
                <span>缺少 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY，暂不能重新订阅</span>
              )}
            </div>
          )}

          <div className="push-sync-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRecordPushSyncSnapshot}
              disabled={!pushSubscription}
            >
              记录同步快照
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearPushSyncSnapshot}
              disabled={!pushSyncRecord}
            >
              清除快照
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleSubscribePush}
              disabled={pushBusy || pushSyncHealth.primaryAction !== "resubscribe" || webPushPublicKey.trim() === ""}
            >
              重新订阅
            </button>
          </div>
        </div>

        <div className="settings-actions-row">
          <button
            className="btn btn-primary"
            onClick={handleRequestPushPermission}
            disabled={pushBusy || pushReadiness.primaryAction !== "request-permission"}
          >
            申请通知权限
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSubscribePush}
            disabled={pushBusy || pushReadiness.primaryAction !== "subscribe"}
          >
            创建推送订阅
          </button>
          <button className="btn btn-ghost" onClick={handleSendLocalNotification} disabled={pushBusy}>
            发送本地测试通知
          </button>
        </div>
      </section>

      {showAddDevice && (
        <section className="card animate-fade-in-up">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">添加新设备</h2>
              <p className="card-subtitle">先登记设备位置信息，后续再接入真实配网流程。</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDevice(false)}>
              取消
            </button>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label className="form-label" htmlFor="new-device-name">设备名称</label>
              <input
                id="new-device-name"
                className="form-control"
                type="text"
                placeholder="输入设备名称"
                value={newDevice.name}
                onChange={(event) => setNewDevice((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="new-device-type">设备类型</label>
              <select
                id="new-device-type"
                className="form-control"
                value={newDevice.type}
                onChange={(event) => setNewDevice((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="relay-controller">继电器</option>
                <option value="environment-sensor">传感器</option>
                <option value="smart-plug">智能插座</option>
                <option value="camera">摄像头</option>
                <option value="door-lock">门锁</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="new-device-room">所属房间</label>
              <input
                id="new-device-room"
                className="form-control"
                type="text"
                placeholder="输入房间名称"
                value={newDevice.room}
                onChange={(event) => setNewDevice((current) => ({ ...current, room: event.target.value }))}
              />
            </div>

            <div className="settings-field">
              <label className="form-label" htmlFor="new-device-home">所属家庭</label>
              <select
                id="new-device-home"
                className="form-control"
                value={newDevice.home}
                onChange={(event) => setNewDevice((current) => ({ ...current, home: event.target.value }))}
              >
                <option value="温馨公寓">温馨公寓</option>
                <option value="办公室">办公室</option>
              </select>
            </div>
          </div>

          <div className="settings-actions-row">
            <button
              className="btn btn-primary"
              onClick={handleAddDevice}
              disabled={newDevice.name.trim() === "" || newDevice.room.trim() === ""}
            >
              保存新设备
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddDevice(false)}>
              取消
            </button>
          </div>
        </section>
      )}

      <section className="card animate-fade-in-up delay-4">
        <div className="card-header">
          <div>
            <h2 className="card-title card-title--md">设备维护</h2>
            <p className="card-subtitle">查看注册信息，执行重启、编辑和恢复出厂动作。</p>
          </div>
          <div className="settings-count-pill">共 {devices.length} 台设备</div>
        </div>

        <div className="settings-device-list">
          {devices.map((device, idx) => (
            <article key={device.id} className="settings-device-item animate-fade-in-up" style={{ animationDelay: `${idx * 45}ms` }}>
              <div className="settings-device-topline">
                <div className="settings-device-identity">
                  <div className="settings-device-icon">{getDeviceIcon(device.type)}</div>
                  <div>
                    <h3>{device.name}</h3>
                    <p>{getDeviceTypeLabel(device.type)} · {device.home} · {device.room}</p>
                  </div>
                </div>
                <div className="settings-device-status">
                  <span className={`badge ${device.online ? "badge-success" : "badge-danger"}`}>
                    {device.online ? "在线" : "离线"}
                  </span>
                  <span>{formatLastSeen(device.lastSeen)}</span>
                </div>
              </div>

              <div className="settings-device-meta-grid">
                <DeviceMeta label="IP 地址" value={device.ip} monospace />
                <DeviceMeta label="MAC 地址" value={device.mac} monospace />
                <DeviceMeta label="固件版本" value={device.firmware} />
                <DeviceMeta label="设备 ID" value={device.id} monospace />
              </div>

              <div className="settings-actions-row">
                <Link href={`/devices/${device.id}`} className="btn btn-ghost btn-sm">
                  查看详情
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(device)}>
                  编辑配置
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRestart(device)} disabled={!device.online}>
                  重启设备
                </button>
                <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleFactoryReset(device)}>
                  恢复出厂
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isEditing && selectedDevice && (
        <>
          <div className="settings-backdrop" onClick={() => setIsEditing(false)} />
          <section className="card settings-modal" role="dialog" aria-modal="true" aria-labelledby="edit-device-title">
            <div className="card-header">
              <div>
                <h2 id="edit-device-title" className="card-title card-title--md">编辑设备配置</h2>
                <p className="card-subtitle">{selectedDevice.name}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>
                关闭
              </button>
            </div>

            <div className="settings-form-grid settings-form-grid--single">
              <div className="settings-field">
                <label className="form-label" htmlFor="edit-device-name">设备名称</label>
                <input
                  id="edit-device-name"
                  className="form-control"
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>

              <div className="settings-field">
                <label className="form-label" htmlFor="edit-device-room">所属房间</label>
                <input
                  id="edit-device-room"
                  className="form-control"
                  type="text"
                  value={editForm.room}
                  onChange={(event) => setEditForm((current) => ({ ...current, room: event.target.value }))}
                />
              </div>
            </div>

            <div className="settings-actions-row">
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={editForm.name.trim() === "" || editForm.room.trim() === ""}
              >
                保存配置
              </button>
              <button className="btn btn-ghost" onClick={() => setIsEditing(false)}>
                取消
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function NotificationInboxMetric({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "warning" | "danger" | "info";
}) {
  return (
    <div className="notification-inbox-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function NotificationInboxCard({
  item,
  onChangeState
}: {
  item: NotificationInboxItem;
  onChangeState: (id: string, state: NotificationInboxState) => void;
}) {
  const isArchived = item.state === "archived";
  const isUnread = item.state === "unread";

  return (
    <article className="notification-inbox-item" data-state={item.state} data-priority={item.priority}>
      <div className="notification-inbox-item__icon" data-priority={item.priority}>
        {getNotificationPriorityIcon(item.priority)}
      </div>
      <div className="notification-inbox-item__body">
        <div className="notification-inbox-item__title-row">
          <h3>{item.title}</h3>
          <span className="notification-priority-badge" data-priority={item.priority}>
            {getNotificationPriorityLabel(item.priority)}
          </span>
        </div>
        <p>{item.message}</p>
        <div className="notification-inbox-item__meta">
          <span>{getNotificationSourceLabel(item.source)}</span>
          <span>{formatNotificationTime(item.timestamp)}</span>
          <span>{item.deliveryTarget}</span>
          {item.deviceName && item.deviceId && (
            <Link href={`/devices/${item.deviceId}`}>
              {item.deviceName}
            </Link>
          )}
        </div>
      </div>
      <div className="notification-inbox-item__actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onChangeState(item.id, isUnread ? "read" : "unread")}
          disabled={isArchived}
        >
          {isUnread ? "标为已读" : "恢复未读"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onChangeState(item.id, isArchived ? "read" : "archived")}
        >
          {isArchived ? "取消归档" : "归档"}
        </button>
      </div>
    </article>
  );
}

function DeviceMeta({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={monospace ? "settings-monospace" : undefined}>{value}</strong>
    </div>
  );
}

function PushCheckItem({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="push-check-item" data-active={active ? "true" : "false"}>
      <span>{active ? "✓" : "!"}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function PushSyncDetail({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="push-sync-detail">
      <span>{label}</span>
      <strong className={monospace ? "settings-monospace" : undefined}>{value}</strong>
    </div>
  );
}

function getLandingLabel(value: DefaultLanding): string {
  switch (value) {
    case "homes": return "总览";
    case "devices": return "设备";
    case "activity": return "日志";
    default: return "首页";
  }
}

function getPermissionLabel(value: PushPermissionState): string {
  switch (value) {
    case "granted": return "已授权";
    case "denied": return "已拒绝";
    case "default": return "待授权";
    default: return "不可用";
  }
}

function getPushStatusLabel(value: ReturnType<typeof buildPushReadiness>["status"]): string {
  switch (value) {
    case "subscribed": return "已就绪";
    case "ready-to-subscribe": return "可订阅";
    case "waiting-for-vapid": return "待公钥";
    case "needs-permission": return "待授权";
    case "permission-denied": return "已拒绝";
    default: return "不可用";
  }
}

function getPushSyncStatusLabel(value: ReturnType<typeof buildPushSubscriptionSyncHealth>["status"]): string {
  switch (value) {
    case "synced": return "已同步";
    case "not-synced": return "待同步";
    case "endpoint-changed": return "端点变更";
    case "expired": return "已过期";
    case "stale": return "建议重订阅";
    default: return "无端点";
  }
}

function formatPushSyncDate(value: string | null): string {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSavedNotificationViewLabel(
  view: NotificationInboxViewState,
  deviceOptions: ReturnType<typeof getNotificationInboxDeviceOptions>
): string {
  const segments = [getNotificationFilterShortLabel(view.filter)];
  const filters = view.advancedFilters;
  const query = filters.query.trim();

  if (query) {
    segments.push(`搜索“${query}”`);
  }

  if (filters.deviceId !== defaultNotificationInboxAdvancedFilters.deviceId) {
    const device = deviceOptions.find((option) => option.id === filters.deviceId);
    segments.push(`设备：${device?.name ?? filters.deviceId}`);
  }

  if (filters.priority !== defaultNotificationInboxAdvancedFilters.priority) {
    segments.push(getNotificationPriorityFilterLabel(filters.priority));
  }

  if (filters.source !== defaultNotificationInboxAdvancedFilters.source) {
    segments.push(getNotificationSourceFilterLabel(filters.source));
  }

  return `已保存视图：${segments.join(" / ")} · ${formatNotificationTime(view.savedAt)}`;
}

function getNotificationFilterShortLabel(value: NotificationInboxFilter): string {
  switch (value) {
    case "unread": return "未读";
    case "critical": return "关键";
    case "archived": return "归档";
    default: return "全部";
  }
}

function getNotificationFilterLabel(
  value: NotificationInboxFilter,
  summary: ReturnType<typeof getNotificationInboxSummary>
): string {
  switch (value) {
    case "unread": return `未读 ${summary.unread}`;
    case "critical": return `关键 ${summary.criticalUnread}`;
    case "archived": return `归档 ${summary.archived}`;
    default: return `全部 ${summary.totalVisible}`;
  }
}

function getNotificationPriorityLabel(value: NotificationInboxPriority): string {
  switch (value) {
    case "critical": return "关键";
    case "warning": return "警告";
    case "summary": return "摘要";
    default: return "普通";
  }
}

function getNotificationPriorityFilterLabel(value: NotificationInboxPriorityFilter): string {
  return value === "all" ? "全部优先级" : getNotificationPriorityLabel(value);
}

function getNotificationPriorityIcon(value: NotificationInboxPriority): string {
  switch (value) {
    case "critical": return "!";
    case "warning": return "△";
    case "summary": return "∑";
    default: return "•";
  }
}

function getNotificationSourceFilterLabel(value: NotificationInboxSourceFilter): string {
  return value === "all" ? "全部来源" : getNotificationSourceLabel(value);
}

function getNotificationSourceLabel(value: NotificationInboxSource): string {
  switch (value) {
    case "device": return "设备事件";
    case "push": return "推送投递";
    case "summary": return "运行摘要";
    default: return "系统";
  }
}

function formatNotificationTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getNoticeTone(message: string): "success" | "warning" | "danger" | "info" {
  if (message.includes("🔄")) {
    return "info";
  }

  if (message.includes("失败") || message.includes("不支持") || message.includes("拒绝")) {
    return "danger";
  }

  if (message.includes("需要") || message.includes("未授权")) {
    return "warning";
  }

  return "success";
}

function getNoticeIcon(message: string): string {
  const tone = getNoticeTone(message);

  if (tone === "info") return "⏳";
  if (tone === "danger") return "❌";
  if (tone === "warning") return "⚠️";
  return "✅";
}

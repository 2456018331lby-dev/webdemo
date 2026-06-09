"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { homes } from "@/lib/mock-data";
import {
  DEVICE_FILTER_VIEW_STORAGE_KEY,
  DEVICE_FAVORITES_STORAGE_KEY,
  buildDeviceList,
  createDeviceFilterViewState,
  defaultDeviceFilterCriteria,
  filterAndSortDevices,
  hasActiveDeviceFilters,
  parseDeviceFilterView,
  parseFavoriteIds,
  serializeDeviceFilterView,
  serializeFavoriteIds,
  toggleFavoriteId,
  type DeviceFilterCriteria,
  type DeviceFilterViewState
} from "@/lib/device-list";
import {
  CSV_MIME_TYPE,
  JSON_MIME_TYPE,
  downloadTextFile,
  getDeviceTypeLabel,
  makeExportFilename,
  serializeDevicesAsCsv,
  serializeDevicesAsJson
} from "@/lib/export-data";

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

export default function DevicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [savedView, setSavedView] = useState<DeviceFilterViewState | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  useEffect(() => {
    setFavoriteIds(new Set(parseFavoriteIds(window.localStorage.getItem(DEVICE_FAVORITES_STORAGE_KEY))));
    const restoredView = parseDeviceFilterView(window.localStorage.getItem(DEVICE_FILTER_VIEW_STORAGE_KEY));

    if (restoredView) {
      applyFilterCriteria(restoredView.filters);
      setSavedView(restoredView);
    }

    setFavoritesHydrated(true);
  }, []);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    window.localStorage.setItem(DEVICE_FAVORITES_STORAGE_KEY, serializeFavoriteIds(favoriteIds));
  }, [favoriteIds, favoritesHydrated]);

  const allDevices = useMemo(() => buildDeviceList(homes), []);

  const filteredDevices = useMemo(
    () =>
      filterAndSortDevices(allDevices, {
        searchQuery,
        filterType,
        filterStatus,
        favoriteOnly,
        favoriteIds
      }),
    [allDevices, favoriteIds, favoriteOnly, filterStatus, filterType, searchQuery]
  );

  const favoriteDevices = useMemo(
    () => allDevices.filter((device) => favoriteIds.has(device.id)),
    [allDevices, favoriteIds]
  );

  const currentFilterCriteria: DeviceFilterCriteria = {
    searchQuery,
    filterType,
    filterStatus,
    favoriteOnly
  };

  const onlineCount = allDevices.filter(d => d.online).length;
  const offlineCount = allDevices.filter(d => !d.online).length;
  const relayCount = allDevices.filter(d => d.type === "relay-controller").length;
  const sensorCount = allDevices.filter(d => d.type === "environment-sensor").length;
  const favoriteCount = favoriteIds.size;

  const deviceTypes = useMemo(() => {
    const types = new Set(allDevices.map(d => d.type));
    return Array.from(types);
  }, [allDevices]);

  // 快捷控制：批量开关
  const [isControlling, setIsControlling] = useState(false);
  const [controlResult, setControlResult] = useState<string | null>(null);

  function toggleFavorite(deviceId: string) {
    setFavoriteIds((current) => new Set(toggleFavoriteId(current, deviceId)));
  }

  function applyFilterCriteria(filters: DeviceFilterCriteria) {
    setSearchQuery(filters.searchQuery);
    setFilterType(filters.filterType);
    setFilterStatus(filters.filterStatus);
    setFavoriteOnly(filters.favoriteOnly);
  }

  function clearFilters() {
    applyFilterCriteria(defaultDeviceFilterCriteria);
  }

  function showDeviceNotice(message: string, duration = 2600) {
    setDeviceNotice(message);
    window.setTimeout(() => setDeviceNotice(null), duration);
  }

  function saveDeviceView() {
    const nextView = createDeviceFilterViewState(currentFilterCriteria);
    window.localStorage.setItem(DEVICE_FILTER_VIEW_STORAGE_KEY, serializeDeviceFilterView(nextView));
    setSavedView(nextView);
    showDeviceNotice("✅ 已保存设备筛选视图");
  }

  function restoreDeviceView() {
    if (!savedView) {
      showDeviceNotice("没有可恢复的设备筛选视图");
      return;
    }

    applyFilterCriteria(savedView.filters);
    showDeviceNotice("✅ 已恢复设备筛选视图");
  }

  function clearSavedDeviceView() {
    window.localStorage.removeItem(DEVICE_FILTER_VIEW_STORAGE_KEY);
    setSavedView(null);
    showDeviceNotice("已清除保存的设备筛选视图");
  }

  function exportFilteredDevices(format: "csv" | "json") {
    const contents =
      format === "csv"
        ? serializeDevicesAsCsv(filteredDevices, favoriteIds)
        : serializeDevicesAsJson(filteredDevices, favoriteIds);
    const mimeType = format === "csv" ? CSV_MIME_TYPE : JSON_MIME_TYPE;

    downloadTextFile(makeExportFilename("devices", format), contents, mimeType);
  }

  async function batchControl(turnOn: boolean) {
    setIsControlling(true);
    setControlResult(null);
    
    const relays = filteredDevices.filter(d => d.type === "relay-controller" && d.online);
    const action = turnOn ? "开启" : "关闭";
    
    try {
      // 模拟批量控制
      await new Promise(resolve => setTimeout(resolve, 1000));
      setControlResult(`✅ 已${action} ${relays.length} 个继电器`);
    } catch {
      setControlResult(`❌ 批量${action}失败`);
    } finally {
      setIsControlling(false);
      setTimeout(() => setControlResult(null), 3000);
    }
  }

  const savedViewLabel = savedView ? getSavedDeviceViewLabel(savedView) : "未保存设备筛选视图";
  const hasActiveFilters = hasActiveDeviceFilters(currentFilterCriteria);

  return (
    <div className="page-grid">
      {/* Hero 区域 */}
      <section className="hero animate-fade-in-up">
        <div className="hero-label">
          <span>📱</span>
          <span>设备管理</span>
        </div>
        <h1 className="hero-title">所有设备</h1>
        <p className="hero-description">
          管理和控制所有智能家居设备，支持搜索、筛选和批量操作。
        </p>
      </section>

      {/* 统计概览 */}
      <section className="stat-grid animate-fade-in-up delay-1">
        <div className="stat-card">
          <div className="stat-label">总设备</div>
          <div className="stat-value">{allDevices.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在线设备</div>
          <div className="stat-value stat-value--success">{onlineCount}</div>
          <div className="stat-change positive">{Math.round((onlineCount / allDevices.length) * 100)}% 在线率</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">离线设备</div>
          <div className={`stat-value ${offlineCount > 0 ? "stat-value--danger" : "stat-value--success"}`}>{offlineCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">收藏设备</div>
          <div className="stat-value stat-value--favorite">{favoriteCount}</div>
          <div className="stat-change neutral">本机快捷入口</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">继电器</div>
          <div className="stat-value">{relayCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">传感器</div>
          <div className="stat-value">{sensorCount}</div>
        </div>
      </section>

      {/* 搜索和筛选 */}
      <section className="card animate-fade-in-up delay-2">
        <div className="card-header">
          <div>
            <h2 className="card-title card-title--md">🔍 搜索和筛选</h2>
            <p className="card-subtitle">快速定位设备</p>
          </div>
          <div className="devices-panel-actions">
            <Link href="/homes" className="btn btn-ghost btn-sm">
              📊 全局健康
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportFilteredDevices("csv")}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportFilteredDevices("json")}
            >
              导出 JSON
            </button>
          </div>
        </div>

        <div className="devices-filter-grid">
          {/* 搜索框 */}
          <div className="devices-search-field">
            <input
              type="text"
              aria-label="搜索设备"
              placeholder="搜索设备名称、房间..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control form-control--with-icon"
            />
            <span className="devices-search-field__icon">
              🔍
            </span>
          </div>

          {/* 类型筛选 */}
          <select
            aria-label="设备类型"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-control"
          >
            <option value="all">所有类型</option>
            {deviceTypes.map(type => (
              <option key={type} value={type}>{getDeviceTypeLabel(type)}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            aria-label="设备状态"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-control"
          >
            <option value="all">所有状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
          </select>
        </div>

        {/* 快捷操作 */}
        <div className="devices-quick-actions">
          <span className="devices-quick-actions__label">快捷操作:</span>
          <button 
            className={`btn btn-sm ${favoriteOnly ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setFavoriteOnly((current) => !current)}
            aria-pressed={favoriteOnly}
          >
            {favoriteOnly ? "⭐ 显示全部" : "⭐ 只看收藏"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSearchQuery("")}
            disabled={searchQuery === ""}
          >
            清除搜索
          </button>
          <button 
            className="btn btn-ghost btn-sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            重置筛选
          </button>
          <div className="devices-batch-actions">
            {controlResult && (
              <span className={`devices-control-result ${controlResult.includes("✅") ? "devices-control-result--success" : "devices-control-result--danger"}`}>
                {controlResult}
              </span>
            )}
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => batchControl(true)}
              disabled={isControlling}
            >
              {isControlling ? "⏳ 控制中..." : "💡 全部开启"}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => batchControl(false)}
              disabled={isControlling}
            >
              {isControlling ? "⏳ 控制中..." : "⚫ 全部关闭"}
            </button>
          </div>
        </div>

        {/* 筛选结果统计 */}
        <div className="filter-result-bar">
          <span>显示 {filteredDevices.length} / {allDevices.length} 台设备</span>
          <button
            onClick={clearFilters}
            className="link-button"
            disabled={!hasActiveFilters}
          >
            清除筛选
          </button>
        </div>

        <div className="activity-view-bar">
          <span>{savedViewLabel}</span>
          <div className="activity-view-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={saveDeviceView}>
              保存设备视图
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={restoreDeviceView}
              disabled={!savedView}
            >
              恢复视图
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearSavedDeviceView}
              disabled={!savedView}
            >
              清除保存
            </button>
          </div>
        </div>

        {deviceNotice && (
          <div className="operation-result operation-result--activity" role="status" data-tone={getDeviceNoticeTone(deviceNotice)}>
            {deviceNotice}
          </div>
        )}
      </section>

      {favoriteDevices.length > 0 && (
        <section className="card devices-favorite-rail animate-fade-in-up delay-3">
          <div className="card-header">
            <div>
              <h2 className="card-title card-title--md">⭐ 收藏设备</h2>
              <p className="card-subtitle">常用设备会固定在列表前面，也可以单独筛选查看。</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setFavoriteOnly(true)}>
              只看收藏
            </button>
          </div>
          <div className="favorite-device-grid">
            {favoriteDevices.map((device) => (
              <Link key={device.id} href={`/devices/${device.id}`} className="favorite-device-chip">
                <span>{getDeviceIcon(device.type)}</span>
                <strong>{device.name}</strong>
                <small>{device.roomName}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 设备列表 */}
      <section className="animate-fade-in-up delay-4">
        {filteredDevices.length === 0 ? (
          <div className="card devices-empty-state">
            <div className="devices-empty-state__icon">🔍</div>
            <h3>未找到匹配的设备</h3>
            <p>{favoriteOnly ? "还没有收藏设备，先在设备卡片右上角点星标。" : "尝试调整搜索条件或筛选器"}</p>
          </div>
        ) : (
          <div className="device-grid">
            {filteredDevices.map((device, idx) => (
              <article
                key={device.id} 
                className={`device-card animate-fade-in-up ${favoriteIds.has(device.id) ? "device-card--favorite" : ""}`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="device-card-header">
                  <div className="device-icon">{getDeviceIcon(device.type)}</div>
                  <div className="device-card__top-actions">
                    <button
                      type="button"
                      className={`favorite-button ${favoriteIds.has(device.id) ? "favorite-button--active" : ""}`}
                      aria-pressed={favoriteIds.has(device.id)}
                      aria-label={`${favoriteIds.has(device.id) ? "取消收藏" : "收藏"} ${device.name}`}
                      onClick={() => toggleFavorite(device.id)}
                    >
                      {favoriteIds.has(device.id) ? "★" : "☆"}
                    </button>
                    <div className={`device-status ${device.online ? "online" : "offline"}`}>
                      <span className="device-status-dot"></span>
                      {device.online ? "在线" : "离线"}
                    </div>
                  </div>
                </div>
                
                <div className="device-name">{device.name}</div>
                <div className="device-type">{getDeviceTypeLabel(device.type)}</div>
                
                <div className="device-card__location">
                  <span>🏠</span>
                  <span>{device.homeName}</span>
                  <span className="device-card__location-separator">›</span>
                  <span>{device.roomName}</span>
                </div>
                
                <div className="device-telemetry">
                  {device.lastTelemetry}
                </div>
                
                <div className="device-card__footer">
                  <span className="badge badge-neutral">
                    继电器: {device.relayOn ? "开" : "关"}
                  </span>
                  <Link href={`/devices/${device.id}`} className="device-card__link">
                    查看与控制 →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getSavedDeviceViewLabel(view: DeviceFilterViewState): string {
  const segments = [];

  if (view.filters.filterType !== defaultDeviceFilterCriteria.filterType) {
    segments.push(`类型：${getDeviceFilterTypeLabel(view.filters.filterType)}`);
  }

  if (view.filters.filterStatus !== defaultDeviceFilterCriteria.filterStatus) {
    segments.push(`状态：${getDeviceFilterStatusLabel(view.filters.filterStatus)}`);
  }

  if (view.filters.favoriteOnly) {
    segments.push("只看收藏");
  }

  const query = view.filters.searchQuery.trim();

  if (query) {
    segments.push(`搜索“${query}”`);
  }

  return `已保存视图：${segments.length > 0 ? segments.join(" / ") : "全部设备"} · ${formatSavedViewTime(view.savedAt)}`;
}

function getDeviceFilterTypeLabel(value: string): string {
  return value === "all" ? "所有类型" : getDeviceTypeLabel(value);
}

function getDeviceFilterStatusLabel(value: string): string {
  switch (value) {
    case "online": return "在线";
    case "offline": return "离线";
    default: return "所有状态";
  }
}

function formatSavedViewTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDeviceNoticeTone(message: string): "success" | "info" {
  return message.includes("✅") ? "success" : "info";
}

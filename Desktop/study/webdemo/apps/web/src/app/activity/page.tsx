"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_LOG_VIEW_STORAGE_KEY,
  activityLogs,
  createActivityLogViewState,
  defaultActivityLogFilters,
  getFilteredActivityLogs,
  hasActiveActivityLogFilters,
  parseActivityLogView,
  serializeActivityLogView,
  type ActivityLog,
  type ActivityLogFilterLevel,
  type ActivityLogFilters,
  type ActivityLogFilterType,
  type ActivityLogViewState
} from "@/lib/activity-logs";
import {
  CSV_MIME_TYPE,
  JSON_MIME_TYPE,
  downloadTextFile,
  getActivityLogLevelLabel,
  getActivityLogTypeLabel,
  makeExportFilename,
  serializeActivityLogsAsCsv,
  serializeActivityLogsAsJson
} from "@/lib/export-data";

function getLogIcon(type: ActivityLog["type"]): string {
  switch (type) {
    case "command": return "⚡";
    case "alert": return "🔔";
    case "system": return "🖥️";
    case "device": return "📡";
    default: return "📝";
  }
}

function getLevelBadgeClass(level: ActivityLog["level"]): string {
  switch (level) {
    case "success": return "badge-success";
    case "warning": return "badge-warning";
    case "error": return "badge-danger";
    default: return "badge-info";
  }
}

function formatTime(timestamp: string): string {
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

export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityLogFilters>(defaultActivityLogFilters);
  const [savedView, setSavedView] = useState<ActivityLogViewState | null>(null);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);

  useEffect(() => {
    const restoredView = parseActivityLogView(window.localStorage.getItem(ACTIVITY_LOG_VIEW_STORAGE_KEY));

    if (restoredView) {
      setFilters(restoredView.filters);
      setSavedView(restoredView);
    }
  }, []);

  const filteredLogs = useMemo(() => {
    return getFilteredActivityLogs(activityLogs, filters);
  }, [filters]);

  const stats = useMemo(() => {
    const total = activityLogs.length;
    const errors = activityLogs.filter(l => l.level === "error").length;
    const warnings = activityLogs.filter(l => l.level === "warning").length;
    const success = activityLogs.filter(l => l.level === "success").length;
    return { total, errors, warnings, success };
  }, []);

  function exportFilteredLogs(format: "csv" | "json") {
    const contents =
      format === "csv"
        ? serializeActivityLogsAsCsv(filteredLogs)
        : serializeActivityLogsAsJson(filteredLogs);
    const mimeType = format === "csv" ? CSV_MIME_TYPE : JSON_MIME_TYPE;

    downloadTextFile(makeExportFilename("activity-logs", format), contents, mimeType);
  }

  function updateFilters(update: Partial<ActivityLogFilters>) {
    setFilters((current) => ({ ...current, ...update }));
  }

  function clearFilters() {
    setFilters(defaultActivityLogFilters);
  }

  function showActivityNotice(message: string, duration = 2600) {
    setActivityNotice(message);
    window.setTimeout(() => setActivityNotice(null), duration);
  }

  function saveActivityView() {
    const nextView = createActivityLogViewState(filters);
    window.localStorage.setItem(ACTIVITY_LOG_VIEW_STORAGE_KEY, serializeActivityLogView(nextView));
    setSavedView(nextView);
    showActivityNotice("✅ 已保存日志筛选视图");
  }

  function restoreActivityView() {
    if (!savedView) {
      showActivityNotice("没有可恢复的日志筛选视图");
      return;
    }

    setFilters(savedView.filters);
    showActivityNotice("✅ 已恢复日志筛选视图");
  }

  function clearSavedActivityView() {
    window.localStorage.removeItem(ACTIVITY_LOG_VIEW_STORAGE_KEY);
    setSavedView(null);
    showActivityNotice("已清除保存的日志筛选视图");
  }

  const savedViewLabel = savedView ? getSavedActivityViewLabel(savedView) : "未保存日志筛选视图";
  const hasActiveFilters = hasActiveActivityLogFilters(filters);

  return (
    <div className="page-grid">
      {/* Hero 区域 */}
      <section className="hero animate-fade-in-up">
        <div className="hero-label">
          <span>📋</span>
          <span>系统日志</span>
        </div>
        <h1 className="hero-title">活动记录</h1>
        <p className="hero-description">
          查看系统活动日志、命令执行记录、设备告警和系统事件。
        </p>
        <div className="hero-actions">
          <Link href="/homes" className="btn btn-secondary">
            📊 全局健康
          </Link>
          <Link href="/devices" className="btn btn-secondary">
            📱 所有设备
          </Link>
        </div>
      </section>

      {/* 统计概览 */}
      <section className="stat-grid animate-fade-in-up delay-1">
        <div className="stat-card">
          <div className="stat-label">总日志</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">成功</div>
          <div className="stat-value stat-value--success">{stats.success}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">警告</div>
          <div className="stat-value stat-value--warning">{stats.warnings}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">错误</div>
          <div className="stat-value stat-value--danger">{stats.errors}</div>
        </div>
      </section>

      {/* 筛选和搜索 */}
      <section className="card animate-fade-in-up delay-2">
        <div className="card-header">
          <div>
            <h2 className="card-title card-title--md">🔍 筛选日志</h2>
            <p className="card-subtitle">按类型、级别或关键词筛选</p>
          </div>
          <div className="devices-panel-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportFilteredLogs("csv")}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportFilteredLogs("json")}
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
              aria-label="搜索日志"
              placeholder="搜索日志..."
              value={filters.query}
              onChange={(e) => updateFilters({ query: e.target.value })}
              className="form-control form-control--with-icon"
            />
            <span className="devices-search-field__icon">🔍</span>
          </div>

          {/* 类型筛选 */}
          <select
            aria-label="日志类型"
            value={filters.type}
            onChange={(e) => updateFilters({ type: e.target.value as ActivityLogFilterType })}
            className="form-control"
          >
            <option value="all">所有类型</option>
            <option value="command">命令</option>
            <option value="alert">告警</option>
            <option value="system">系统</option>
            <option value="device">设备</option>
          </select>

          {/* 级别筛选 */}
          <select
            aria-label="日志级别"
            value={filters.level}
            onChange={(e) => updateFilters({ level: e.target.value as ActivityLogFilterLevel })}
            className="form-control"
          >
            <option value="all">所有级别</option>
            <option value="success">成功</option>
            <option value="info">信息</option>
            <option value="warning">警告</option>
            <option value="error">错误</option>
          </select>
        </div>

        <div className="filter-result-bar">
          <span>
            显示 {filteredLogs.length} 条日志
            {hasActiveFilters ? "，已应用筛选条件" : "，未使用筛选条件"}
          </span>
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={saveActivityView}>
              保存日志视图
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={restoreActivityView}
              disabled={!savedView}
            >
              恢复视图
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearSavedActivityView}
              disabled={!savedView}
            >
              清除保存
            </button>
          </div>
        </div>

        {activityNotice && (
          <div className="operation-result operation-result--activity" role="status" data-tone={getActivityNoticeTone(activityNotice)}>
            {activityNotice}
          </div>
        )}
      </section>

      {/* 日志列表 */}
      <section className="animate-fade-in-up delay-3">
        {filteredLogs.length === 0 ? (
          <div className="card devices-empty-state">
            <div className="devices-empty-state__icon">📭</div>
            <h3>未找到匹配的日志</h3>
            <p>尝试调整筛选条件</p>
          </div>
        ) : (
          <div className="command-list">
            {filteredLogs.map((log, idx) => {
              return (
                <div 
                  key={log.id} 
                  className="command-item activity-log-item animate-fade-in-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="activity-log-item__main">
                    <div className="activity-log-item__icon" data-level={log.level}>
                      {getLogIcon(log.type)}
                    </div>
                    
                    <div className="activity-log-item__body">
                      <div className="activity-log-item__title-row">
                        <strong>{log.title}</strong>
                        <span className={`badge ${getLevelBadgeClass(log.level)}`}>
                          {getActivityLogLevelLabel(log.level)}
                        </span>
                        <span className="badge badge-neutral">
                          {getActivityLogTypeLabel(log.type)}
                        </span>
                      </div>
                      
                      <p className="activity-log-item__message">
                        {log.message}
                      </p>
                      
                      {log.deviceName && (
                        <Link 
                          href={`/devices/${log.deviceId}`}
                          className="activity-log-item__device-link"
                        >
                          📱 {log.deviceName}
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  <div className="activity-log-item__time">
                    {formatTime(log.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function getSavedActivityViewLabel(view: ActivityLogViewState): string {
  const segments = [];

  if (view.filters.type !== defaultActivityLogFilters.type) {
    segments.push(`类型：${getActivityFilterTypeLabel(view.filters.type)}`);
  }

  if (view.filters.level !== defaultActivityLogFilters.level) {
    segments.push(`级别：${getActivityFilterLevelLabel(view.filters.level)}`);
  }

  const query = view.filters.query.trim();

  if (query) {
    segments.push(`搜索“${query}”`);
  }

  return `已保存视图：${segments.length > 0 ? segments.join(" / ") : "全部日志"} · ${formatSavedViewTime(view.savedAt)}`;
}

function getActivityFilterTypeLabel(value: ActivityLogFilterType): string {
  return value === "all" ? "所有类型" : getActivityLogTypeLabel(value);
}

function getActivityFilterLevelLabel(value: ActivityLogFilterLevel): string {
  return value === "all" ? "所有级别" : getActivityLogLevelLabel(value);
}

function formatSavedViewTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getActivityNoticeTone(message: string): "success" | "info" {
  return message.includes("✅") ? "success" : "info";
}

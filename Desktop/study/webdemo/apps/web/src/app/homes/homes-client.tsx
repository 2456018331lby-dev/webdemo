"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HomeDevice = {
  id: string; name: string; type: string; online: boolean;
  relayOn: boolean; lastTelemetry: string;
  latestCommandStatus: string | null; attemptCount: number | null; nextRetryAt: string | null;
};
type HomeRoom = { id: string; name: string; devices: HomeDevice[] };
type HomeSnapshot = {
  id: string; name: string; memberRole: string;
  deviceCount: number; offlineCount: number; timedOutCount: number; failedCount: number; retryingCount: number;
  rooms: HomeRoom[]; evaluatedAt: string;
};

type RefreshState = "idle" | "refreshing" | "error";

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

function getStatusBadge(status: string | null) {
  switch (status) {
    case "timed_out": return { label: "已超时", className: "badge-warning" };
    case "failed": return { label: "失败", className: "badge-danger" };
    case "queued": return { label: "排队中", className: "badge-info" };
    case "delivered": return { label: "已送达", className: "badge-info" };
    case "acknowledged": return { label: "已确认", className: "badge-success" };
    default: return null;
  }
}

async function fetchHomeSnapshots(): Promise<HomeSnapshot[]> {
  const res = await fetch("/api/homes/snapshot", { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Snapshot request failed: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data.homes) || data.homes.length === 0) {
    throw new Error("Snapshot response did not include homes");
  }

  return data.homes;
}

function getLatestEvaluatedAt(homes: HomeSnapshot[]): string | null {
  return homes
    .map((home) => home.evaluatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}

function formatSnapshotTime(timestamp: string | null): string {
  if (!timestamp) {
    return "尚未同步";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function HomesClient({ initialHomes }: { initialHomes: HomeSnapshot[] }) {
  const [homes, setHomes] = useState(initialHomes);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(() => getLatestEvaluatedAt(initialHomes));

  const applySnapshots = useCallback((nextHomes: HomeSnapshot[]) => {
    setHomes(nextHomes);
    setLastUpdatedAt(getLatestEvaluatedAt(nextHomes));
    setRefreshMessage(null);
    setRefreshState("idle");
  }, []);

  const refreshHomes = useCallback(async () => {
    setRefreshState("refreshing");
    setRefreshMessage(null);

    try {
      applySnapshots(await fetchHomeSnapshots());
    } catch {
      setRefreshState("error");
      setRefreshMessage("刷新失败，继续显示上次快照");
    }
  }, [applySnapshots]);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const nextHomes = await fetchHomeSnapshots();

        if (active) {
          applySnapshots(nextHomes);
        }
      } catch {
        if (active) {
          setRefreshState("error");
          setRefreshMessage("自动刷新失败，继续显示上次快照");
        }
      }
    }

    const id = setInterval(poll, 15000);
    return () => { active = false; clearInterval(id); };
  }, [applySnapshots]);

  const totals = useMemo(
    () => homes.reduce((a, h) => ({
      d: a.d + h.deviceCount,
      o: a.o + h.offlineCount,
      t: a.t + h.timedOutCount,
      f: a.f + h.failedCount
    }), { d: 0, o: 0, t: 0, f: 0 }),
    [homes]
  );

  const onlineRate = totals.d > 0 ? Math.round(((totals.d - totals.o) / totals.d) * 100) : 0;
  const lastUpdatedLabel = formatSnapshotTime(lastUpdatedAt);

  return (
    <div className="page-grid">
      {/* Hero 区域 */}
      <section className="hero animate-fade-in-up">
        <div className="hero-label">
          <span>📊</span>
          <span>实时监控</span>
        </div>
        <h1 className="hero-title">全局健康度</h1>
        <p className="hero-description">
          监控所有家庭和设备的实时状态，查看在线率、命令成功率和系统健康状况。
        </p>
        <div className="home-hero-actions">
          <Link href="/devices" className="btn btn-secondary">
            📱 查看所有设备
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={refreshHomes}
            disabled={refreshState === "refreshing"}
          >
            {refreshState === "refreshing" ? "同步中..." : "刷新状态"}
          </button>
        </div>
        <div className="home-refresh-status" data-state={refreshState} role="status" aria-live="polite">
          <span>{refreshState === "refreshing" ? "正在同步最新家庭快照" : refreshMessage ?? `最近更新：${lastUpdatedLabel}`}</span>
        </div>
      </section>

      {/* 统计概览 */}
      <section className="stat-grid animate-fade-in-up delay-1">
        <div className="stat-card">
          <div className="stat-label">总设备</div>
          <div className="stat-value">{totals.d}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在线设备</div>
          <div className="stat-value stat-value--success">{totals.d - totals.o}</div>
          <div className="stat-change positive">{onlineRate}% 在线率</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">离线设备</div>
          <div className={`stat-value ${totals.o > 0 ? "stat-value--danger" : "stat-value--success"}`}>{totals.o}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">超时命令</div>
          <div className={`stat-value ${totals.t > 0 ? "stat-value--warning" : "stat-value--success"}`}>{totals.t}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">失败命令</div>
          <div className={`stat-value ${totals.f > 0 ? "stat-value--danger" : "stat-value--success"}`}>{totals.f}</div>
        </div>
      </section>

      {/* 家庭列表 */}
      {homes.map((home, homeIdx) => (
        <section key={home.id} className={`card animate-fade-in-up delay-${Math.min(homeIdx + 2, 4)}`}>
          <div className="card-header">
            <div>
              <h2 className="card-title">🏠 {home.name}</h2>
              <p className="card-subtitle">
                {home.deviceCount} 台设备 · {home.offlineCount} 离线 · {home.timedOutCount} 超时 · {home.failedCount} 失败
              </p>
            </div>
            <div className="home-status-badges">
              {home.timedOutCount > 0 && (
                <span className="badge badge-warning">⚠️ {home.timedOutCount} 超时</span>
              )}
              {home.failedCount > 0 && (
                <span className="badge badge-danger">❌ {home.failedCount} 失败</span>
              )}
              {home.offlineCount === 0 && home.timedOutCount === 0 && home.failedCount === 0 && (
                <span className="badge badge-success">✅ 正常</span>
              )}
            </div>
          </div>

          {/* 超时警告 */}
          {home.timedOutCount > 0 && (
            <div className="home-warning-panel">
              <span className="home-warning-panel__icon">⚠️</span>
              <div>
                <div className="home-warning-panel__title">命令超时警告</div>
                <p>
                  {home.timedOutCount} 条命令未在时限内收到 ack，检查设备链路。
                </p>
              </div>
            </div>
          )}

          {/* 房间列表 */}
          {home.rooms.map((room) => (
            <div key={room.id} className="room-section">
              <div className="room-header">
                <span className="room-icon">🚪</span>
                <span className="room-name">{room.name}</span>
                <span className="room-device-count">
                  {room.devices.length} 台设备
                </span>
              </div>
              
              <div className="device-grid">
                {room.devices.map((device) => {
                  const statusBadge = getStatusBadge(device.latestCommandStatus);
                  return (
                    <Link key={device.id} href={`/devices/${device.id}`} className="device-card">
                      <div className="device-card-header">
                        <div className="device-icon">{getDeviceIcon(device.type)}</div>
                        <div className={`device-status ${device.online ? "online" : "offline"}`}>
                          <span className="device-status-dot"></span>
                          {device.online ? "在线" : "离线"}
                        </div>
                      </div>
                      
                      <div className="device-name">{device.name}</div>
                      <div className="device-type">{getDeviceTypeLabel(device.type)}</div>
                      
                      <div className="device-telemetry">
                        {device.lastTelemetry}
                      </div>
                      
                      <div className="device-card__footer">
                        <div className="device-card__badge-row">
                          {statusBadge && (
                            <span className={`badge ${statusBadge.className}`}>{statusBadge.label}</span>
                          )}
                          <span className="badge badge-neutral">
                            继电器: {device.relayOn ? "开" : "关"}
                          </span>
                        </div>
                        <span className="device-card__link">
                          查看 →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

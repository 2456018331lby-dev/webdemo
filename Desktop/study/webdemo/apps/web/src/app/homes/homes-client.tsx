"use client";

import React, { useEffect, useState } from "react";
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

const postureTone = {
  stable: { bg: "rgba(28,133,84,0.12)", color: "#17603d", border: "rgba(28,133,84,0.18)" },
  watch:  { bg: "rgba(181,106,16,0.12)", color: "#7d4e0a", border: "rgba(181,106,16,0.18)" },
  degraded: { bg: "rgba(180,52,52,0.12)", color: "#8f1f1f", border: "rgba(180,52,52,0.18)" }
};

function posture(h: HomeSnapshot) {
  if (h.timedOutCount > 0 || h.offlineCount > h.deviceCount / 2) return "degraded";
  if (h.offlineCount > 0 || h.failedCount > 0) return "watch";
  return "stable";
}

export function HomesClient({ initialHomes }: { initialHomes: HomeSnapshot[] }) {
  const [homes, setHomes] = useState(initialHomes);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/homes/snapshot", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active && data.homes?.length) setHomes(data.homes);
      } catch { /* keep stale */ }
    }
    const id = setInterval(poll, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const totals = homes.reduce((a, h) => ({
    d: a.d + h.deviceCount, o: a.o + h.offlineCount, t: a.t + h.timedOutCount, f: a.f + h.failedCount
  }), { d: 0, o: 0, t: 0, f: 0 });

  return (
    <main style={{ minHeight: "100vh", padding: "var(--space-page-y) var(--space-page-x) 56px" }}>
      <section className="app-shell">
        <header className="hero-panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ maxWidth: "720px" }}>
              <p className="dark-label">Smart Home Control</p>
              <h1 style={{ margin: "14px 0 12px", fontSize: "44px", lineHeight: 1.05 }}>全局健康度</h1>
              <p className="dark-copy" style={{ margin: 0, fontSize: "15px" }}>
                {totals.d} 台设备 · {totals.o} 离线 · {totals.t} 超时 · {totals.f} 失败
              </p>
            </div>
            <Link href="/devices/device-relay-01" className="primary-cta">进入控制台</Link>
          </div>
          <div className="metric-grid" style={{ marginTop: "24px" }}>
            <article className="metric-card"><p style={{ fontSize: "12px", color: "#a7c2ea", textTransform: "uppercase", letterSpacing: "0.08em" }}>设备</p><strong style={{ display: "block", marginTop: "10px", fontSize: "32px" }}>{totals.d}</strong></article>
            <article className="metric-card" style={totals.o > 0 ? { background: postureTone.degraded.bg, border: `1px solid ${postureTone.degraded.border}`, color: postureTone.degraded.color } : {}}><p style={{ fontSize: "12px", textTransform: "uppercase", opacity: 0.9 }}>离线</p><strong style={{ display: "block", marginTop: "10px", fontSize: "32px" }}>{totals.o}</strong></article>
            <article className="metric-card" style={totals.t > 0 ? { background: postureTone.watch.bg, border: `1px solid ${postureTone.watch.border}`, color: postureTone.watch.color } : {}}><p style={{ fontSize: "12px", textTransform: "uppercase", opacity: 0.9 }}>超时</p><strong style={{ display: "block", marginTop: "10px", fontSize: "32px" }}>{totals.t}</strong></article>
            <article className="metric-card" style={totals.f > 0 ? { background: postureTone.degraded.bg, border: `1px solid ${postureTone.degraded.border}`, color: postureTone.degraded.color } : {}}><p style={{ fontSize: "12px", textTransform: "uppercase", opacity: 0.9 }}>失败</p><strong style={{ display: "block", marginTop: "10px", fontSize: "32px" }}>{totals.f}</strong></article>
          </div>
        </header>

        <div style={{ display: "grid", gap: "22px" }}>
          {homes.map((home) => {
            const p = posture(home);
            const t = postureTone[p];
            return (
              <article key={home.id} className="surface-panel">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <h2 className="page-section-title">{home.name}</h2>
                    <p className="page-section-copy">{home.deviceCount} 设备 · {home.offlineCount} 离线 · {home.timedOutCount} 超时 · {home.failedCount} 失败 · {home.retryingCount} 重试中</p>
                  </div>
                  <span style={{ borderRadius: "var(--radius-pill)", padding: "10px 14px", background: t.bg, color: t.color, border: `1px solid ${t.border}`, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px" }}>{p}</span>
                </div>
                {home.timedOutCount > 0 && (
                  <div style={{ marginTop: "18px", borderRadius: "20px", padding: "18px 20px", background: postureTone.watch.bg, color: postureTone.watch.color, border: `1px solid ${postureTone.watch.border}` }}>
                    <div style={{ fontWeight: 800, fontSize: "20px" }}>命令超时警告</div>
                    <p style={{ margin: "8px 0 0" }}>{home.timedOutCount} 条命令未在时限内收到 ack，检查设备链路。</p>
                  </div>
                )}
                <div style={{ display: "grid", gap: "16px", marginTop: "22px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
                  {home.rooms.map((room) => (
                    <section key={room.id} style={{ borderRadius: "22px", padding: "20px", background: "linear-gradient(180deg, #f6fbff 0%, #eef5fb 100%)", border: "1px solid var(--border-subtle)" }}>
                      <h3 style={{ margin: 0, fontSize: "22px", color: "#14314d" }}>{room.name}</h3>
                      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: "12px" }}>
                        {room.devices.map((device) => {
                          const sc = device.latestCommandStatus === "timed_out" ? postureTone.watch
                            : device.latestCommandStatus === "failed" ? postureTone.degraded
                            : device.online ? postureTone.stable : postureTone.degraded;
                          return (
                            <li key={device.id} style={{ borderRadius: "18px", padding: "16px", background: "var(--bg-panel-strong)", border: "1px solid var(--border-subtle)", display: "grid", gap: "10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                                <strong style={{ color: "#163552" }}>{device.name}</strong>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  {device.latestCommandStatus && (
                                    <span style={{ padding: "4px 8px", borderRadius: "var(--radius-pill)", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>{device.latestCommandStatus.replace("_", " ")}</span>
                                  )}
                                  <span style={{ padding: "4px 8px", borderRadius: "var(--radius-pill)", background: device.online ? "rgba(25,141,85,0.12)" : "rgba(180,52,52,0.12)", color: device.online ? "#16653f" : "#9f2525", fontSize: "11px", fontWeight: 700 }}>{device.online ? "Online" : "Offline"}</span>
                                </div>
                              </div>
                              <p className="info-copy" style={{ margin: 0, fontSize: "14px" }}>{device.lastTelemetry}</p>
                              <Link href={`/devices/${device.id}`} style={{ fontWeight: 800, color: "#174766" }}>查看与控制</Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
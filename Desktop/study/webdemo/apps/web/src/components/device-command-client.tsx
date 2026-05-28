"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CommandHistoryList } from "./command-history-list";
import { DeviceControlPanel } from "./device-control-panel";
import {
  computeRelayCommandCooldownMs,
  formatReliabilityBand,
  formatRiskLabel,
  getDeviceControlSnapshot
} from "@/lib/control-balance";

type CmdEntry = {
  commandId: string;
  commandType: string;
  status: string;
  requestedAt: string;
  attemptCount?: number;
  nextRetryAt?: string | null;
};

type Props = {
  deviceId: string;
  deviceName: string;
  initialRelayOn: boolean;
  isOffline: boolean;
  initialHistory?: CmdEntry[];
  initialTelemetry?: string;
};

function operatorMsg(cmd: CmdEntry | undefined, offline: boolean) {
  if (offline) return "设备离线，等链路恢复后再发命令。";
  if (!cmd) return "暂无命令，当前是静态控制基线。";
  if (cmd.status === "queued") return `等待重试${cmd.attemptCount ? `（第 ${cmd.attemptCount} 次）` : ""}。`;
  if (cmd.status === "timed_out") return "命令超时，检查 ESP32S3→STM32H743 链路。";
  if (cmd.status === "failed") return "命令失败，检查供电/负载/payload。";
  if (cmd.status === "acknowledged") return "命令已确认，reported state 已同步。";
  return "命令已送达，等待硬件确认。";
}

export function DeviceCommandClient({
  deviceId, deviceName, initialRelayOn, isOffline, initialHistory, initialTelemetry
}: Props) {
  const [relayOn, setRelayOn] = useState(initialRelayOn);
  const [offline, setOffline] = useState(isOffline);
  const [history, setHistory] = useState<CmdEntry[]>(initialHistory ?? []);
  const [telemetryNote, setTelemetryNote] = useState(initialTelemetry ?? "");
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const mounted = useRef(true);

  // Single polling effect — no redundant first fetch since we have SSR data
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch(`/api/devices/${deviceId}/commands`, { cache: "no-store" });
        if (!res.ok || !mounted.current) return;
        const p = await res.json();
        if (!mounted.current) return;
        setRelayOn(Boolean(p.state?.relayOn));
        setOffline(!Boolean(p.state?.online));
        setTelemetryNote(p.state?.lastTelemetry ?? "");
        setHistory(p.commandHistory ?? []);
        setFetchErr(null);
      } catch {
        if (mounted.current) setFetchErr("轮询失败");
      }
    }

    // First poll at 3s, then every 5s
    timer = setTimeout(() => { poll(); timer = setInterval(poll, 5000); }, 3000);

    return () => { mounted.current = false; clearTimeout(timer); clearInterval(timer); };
  }, [deviceId]);

  const ctrl = useMemo(
    () => getDeviceControlSnapshot({ online: !offline, relayOn, telemetryText: telemetryNote }),
    [offline, relayOn, telemetryNote]
  );

  const band = formatReliabilityBand(ctrl.reliabilityScore);
  const risk = formatRiskLabel(ctrl.riskScore);
  const cooldown = Math.round(computeRelayCommandCooldownMs({ online: !offline, telemetryText: telemetryNote }) / 1000);
  const tone = risk === "high"
    ? { bg: "rgba(180,52,52,0.12)", fg: "#9f2525", bd: "rgba(180,52,52,0.18)" }
    : risk === "medium"
      ? { bg: "rgba(181,106,16,0.14)", fg: "#8c580d", bd: "rgba(181,106,16,0.18)" }
      : { bg: "rgba(25,141,85,0.12)", fg: "#16653f", bd: "rgba(25,141,85,0.18)" };

  async function send(nextValue: boolean) {
    const res = await fetch(`/api/devices/${deviceId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType: "relay.set", correlationId: crypto.randomUUID(), payload: { channel: 1, value: nextValue } })
    });
    if (!res.ok) throw new Error("Command failed");
    const p = await res.json();
    setRelayOn(Boolean(p.state?.relayOn));
    setOffline(!Boolean(p.state?.online));
    setTelemetryNote(p.state?.lastTelemetry ?? "");
    setHistory(p.commandHistory ?? []);
  }

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      {/* Status bar */}
      <section className="surface-panel" style={{ background: "var(--bg-panel)" }}>
        <div style={{ borderRadius: "20px", padding: "18px 20px", background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.9 }}>控制态势</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "8px" }}>
            <div>
              <strong style={{ fontSize: "24px", lineHeight: 1.3 }}>
                {risk === "high" ? "先停手排查" : risk === "medium" ? "先确认状态再操作" : "链路稳定，可控制"}
              </strong>
              <p style={{ margin: "6px 0 0", lineHeight: 1.6, fontSize: "14px", opacity: 0.9 }}>
                {operatorMsg(history[0], offline)}
              </p>
            </div>
            <div style={{ textAlign: "right", minWidth: "80px" }}>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>可靠度</div>
              <strong style={{ fontSize: "32px", lineHeight: 1 }}>{ctrl.reliabilityScore}</strong>
            </div>
          </div>
        </div>

        <div className="metric-grid" style={{ marginTop: "16px" }}>
          <article className="soft-card">
            <div className="info-label">可靠度</div>
            <strong className="info-value" style={{ fontSize: "28px" }}>{ctrl.reliabilityScore}</strong>
            <div className="info-copy">{band}</div>
          </article>
          <article className="soft-card" style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}>
            <div className="info-label" style={{ color: "currentColor", opacity: 0.9 }}>操作风险</div>
            <strong className="info-value" style={{ fontSize: "28px", color: "currentColor" }}>{risk}</strong>
            <div className="info-copy" style={{ color: "currentColor", opacity: 0.7 }}>score {ctrl.riskScore}</div>
          </article>
          <article className="soft-card">
            <div className="info-label">冷却时间</div>
            <strong className="info-value" style={{ fontSize: "28px" }}>{cooldown}s</strong>
            <div className="info-copy">防止命令风暴</div>
          </article>
          <article className="soft-card">
            <div className="info-label">建议</div>
            <strong className="info-value" style={{ fontSize: "18px" }}>
              {ctrl.recommendedAction === "safe_to_toggle" ? "可直接控制" : "先检查再控制"}
            </strong>
          </article>
        </div>

        {fetchErr && (
          <div style={{ marginTop: "12px", padding: "8px 12px", borderRadius: "10px", background: "rgba(180,52,52,0.08)", color: "#9f2525", fontSize: "13px" }}>
            {fetchErr}
          </div>
        )}
      </section>

      <DeviceControlPanel
        deviceName={deviceName}
        initialRelayOn={relayOn}
        isOffline={offline}
        onSendRelayCommand={send}
      />
      <CommandHistoryList telemetryNote={telemetryNote} history={history} />
    </div>
  );
}
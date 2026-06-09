"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CommandHistoryList } from "./command-history-list";
import { DeviceControlPanel, type RelayCommandSendResult } from "./device-control-panel";
import {
  computeRelayCommandCooldownMs,
  formatReliabilityBandCN,
  formatRiskLabel,
  formatRiskLabelCN,
  formatTelemetryCN,
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
  homeName: string;
  roomName: string;
  deviceName: string;
  deviceType?: string;
  initialRelayOn: boolean;
  isOffline: boolean;
  initialHistory?: CmdEntry[];
  initialTelemetry?: string;
};

type CommandResponsePayload = {
  ack?: {
    result?: string;
  };
  command?: {
    status?: string;
  };
  commandHistory?: CmdEntry[];
  deliveryMode?: string;
  state?: {
    relayOn?: boolean;
    online?: boolean;
    lastTelemetry?: string;
  };
};

function getDeviceIcon(type?: string): string {
  switch (type) {
    case "relay-controller": return "💡";
    case "environment-sensor": return "🌡️";
    case "smart-plug": return "🔌";
    case "camera": return "📷";
    case "door-lock": return "🔒";
    default: return "⚙️";
  }
}

function formatDeviceTypeLabel(type?: string): string {
  switch (type) {
    case "relay-controller": return "继电器控制器";
    case "environment-sensor": return "环境传感器";
    default: return type ?? "未知设备";
  }
}

function operatorMsg(cmd: CmdEntry | undefined, offline: boolean) {
  if (offline) return "设备离线，等链路恢复后再发命令。";
  if (!cmd) return "暂无命令，当前是静态控制基线。";
  if (cmd.status === "queued") return `等待重试${cmd.attemptCount ? `（第 ${cmd.attemptCount} 次）` : ""}。`;
  if (cmd.status === "timed_out") return "命令超时，检查 ESP32S3→STM32H743 链路。";
  if (cmd.status === "failed") return "命令失败，检查供电/负载/payload。";
  if (cmd.status === "acknowledged") return "命令已确认，状态已同步。";
  return "命令已送达，等待硬件确认。";
}

function getRiskAdvice(risk: string, offline: boolean): string {
  if (offline) return "设备离线，请检查网络连接或设备电源。";
  if (risk === "high") return "风险较高，建议先排查问题再操作。";
  if (risk === "medium") return "风险中等，操作前请确认设备状态。";
  return "链路稳定，可以安全操作。";
}

function getStatusColor(status?: "normal" | "warning" | "danger") {
  switch (status) {
    case "warning": return "warning";
    case "danger": return "danger";
    default: return "normal";
  }
}

function getRelaySendResult(payload: CommandResponsePayload): RelayCommandSendResult {
  if (payload.deliveryMode === "polling") {
    return {
      status: "queued",
      note: "命令已进入 ESP32S3 轮询队列，等待设备拉取并上报确认。"
    };
  }

  if (payload.ack?.result === "ok") {
    return { status: "acknowledged" };
  }

  if (payload.ack?.result === "busy") {
    return {
      status: "queued",
      note: "硬件暂忙，命令已保留在重试队列，等待后续生命周期重试。"
    };
  }

  const latestStatus = payload.commandHistory?.[0]?.status ?? payload.command?.status;

  if (latestStatus === "queued" || latestStatus === "delivered") {
    return {
      status: "queued",
      note: "命令尚未收到硬件 ack，当前仍显示设备最后一次上报状态。"
    };
  }

  return { status: "acknowledged" };
}

export function DeviceCommandClient({
  deviceId,
  homeName,
  roomName,
  deviceName,
  deviceType,
  initialRelayOn,
  isOffline,
  initialHistory,
  initialTelemetry
}: Props) {
  const [relayOn, setRelayOn] = useState(initialRelayOn);
  const [offline, setOffline] = useState(isOffline);
  const [history, setHistory] = useState<CmdEntry[]>(initialHistory ?? []);
  const [telemetryNote, setTelemetryNote] = useState(initialTelemetry ?? "");
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const mounted = useRef(true);
  const icon = getDeviceIcon(deviceType);
  const deviceTypeLabel = formatDeviceTypeLabel(deviceType);
  const online = !offline;

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

    timer = setTimeout(() => { poll(); timer = setInterval(poll, 5000); }, 3000);

    return () => { mounted.current = false; clearTimeout(timer); clearInterval(timer); };
  }, [deviceId]);

  const ctrl = useMemo(
    () => getDeviceControlSnapshot({ online, relayOn, telemetryText: telemetryNote }),
    [online, relayOn, telemetryNote]
  );

  const bandCN = formatReliabilityBandCN(ctrl.reliabilityScore);
  const risk = formatRiskLabel(ctrl.riskScore);
  const riskCN = formatRiskLabelCN(ctrl.riskScore);
  const cooldown = Math.round(computeRelayCommandCooldownMs({ online, telemetryText: telemetryNote }) / 1000);
  const telemetryData = useMemo(() => formatTelemetryCN(telemetryNote), [telemetryNote]);
  
  const toneIcon = risk === "high" ? "🔴" : risk === "medium" ? "🟡" : "🟢";

  async function send(nextValue: boolean): Promise<RelayCommandSendResult> {
    const res = await fetch(`/api/devices/${deviceId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType: "relay.set", correlationId: crypto.randomUUID(), payload: { channel: 1, value: nextValue } })
    });
    if (!res.ok) throw new Error("Command failed");
    const p = await res.json() as CommandResponsePayload;
    setRelayOn(Boolean(p.state?.relayOn));
    setOffline(!Boolean(p.state?.online));
    setTelemetryNote(p.state?.lastTelemetry ?? "");
    setHistory(p.commandHistory ?? []);
    return getRelaySendResult(p);
  }

  return (
    <>
      <header className="hero-panel">
        <div className="device-hero">
          <div className="device-hero__identity">
            <span className="device-hero__icon">{icon}</span>
            <div>
              <p className="dark-label">{homeName} / {roomName}</p>
              <h1 className="device-hero__title">{deviceName}</h1>
              <p className="dark-copy device-hero__summary">
                {deviceTypeLabel}
                {" · "}
                {relayOn ? "已开启" : "已关闭"}
                {" · "}
                {online ? "在线" : "离线"}
              </p>
            </div>
          </div>
          <div className="device-hero__status">
            <span className={`device-status-pill ${online ? "device-status-pill--online" : "device-status-pill--offline"}`}>
              {online ? "🟢 Online" : "🔴 Offline"}
            </span>
            {telemetryNote && (
              <span className="device-hero__telemetry">
                {telemetryNote}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="page-grid">
        {/* 面包屑导航 */}
        <div className="breadcrumb-trail">
          <Link href="/" className="breadcrumb-trail__muted">首页</Link>
          <span className="breadcrumb-trail__separator">/</span>
          <Link href="/homes" className="breadcrumb-trail__link">全局健康</Link>
          <span className="breadcrumb-trail__separator">/</span>
          <span className="breadcrumb-trail__current">{deviceName}</span>
        </div>

        {/* 控制态势面板 */}
        <div className="posture-panel animate-fade-in-up">
          <div className="posture-header">
            <div className="posture-main">
              <div className="posture-label">控制态势</div>
              <div className="posture-title">
                <span>{toneIcon}</span>
                <span>{risk === "high" ? "先停手排查" : risk === "medium" ? "先确认状态再操作" : "链路稳定，可控制"}</span>
              </div>
              <p className="posture-description">{operatorMsg(history[0], offline)}</p>
              <p className="posture-advice">
                {getRiskAdvice(risk, offline)}
              </p>
            </div>
            <div className="posture-score">
              <div className="posture-score-label">可靠度</div>
              <div className="posture-score-value">{ctrl.reliabilityScore}</div>
              <div className="posture-score-unit">{bandCN}</div>
            </div>
          </div>

          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-label">操作风险</div>
              <div className={`metric-value metric-value--risk-${risk}`}>
                {toneIcon} {riskCN}
              </div>
              <div className="metric-sublabel">分数: {ctrl.riskScore}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">冷却时间</div>
              <div className="metric-value">⏱️ {cooldown}s</div>
              <div className="metric-sublabel">防止命令风暴</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">建议操作</div>
              <div className="metric-value metric-value--compact">
                {ctrl.recommendedAction === "safe_to_toggle" ? "✅ 可直接控制" : "⚠️ 先检查再控制"}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">命令历史</div>
              <div className="metric-value">📜 {history.length}</div>
              <div className="metric-sublabel">条记录</div>
            </div>
          </div>

          {fetchErr && (
            <div className="inline-alert inline-alert--danger">
              <span>⚠️</span>
              <span>{fetchErr}</span>
            </div>
          )}
        </div>

        {/* 遥测数据面板 */}
        {telemetryData.length > 0 && (
          <div className="card animate-fade-in-up delay-1">
            <div className="card-header">
              <div>
                <h3 className="card-title card-title--sm">📡 遥测数据</h3>
                <p className="card-subtitle">实时传感器数据</p>
              </div>
            </div>
            <div className="stat-grid">
              {telemetryData.map((item, idx) => {
                const tone = getStatusColor(item.status);
                return (
                  <div key={idx} className="stat-card telemetry-stat-card" data-telemetry-status={tone}>
                    <div className="stat-label">{item.label}</div>
                    <div className="stat-value">
                      {item.value}
                      <span className="telemetry-stat-card__unit">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DeviceControlPanel
          deviceName={deviceName}
          deviceType={deviceType}
          relayOn={relayOn}
          isOffline={offline}
          commandCooldownMs={ctrl.cooldownMs}
          onSendRelayCommand={send}
        />
        <CommandHistoryList telemetryNote={telemetryNote} history={history} />
      </div>
    </>
  );
}

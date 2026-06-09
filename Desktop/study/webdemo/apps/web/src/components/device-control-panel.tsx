"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  deviceName: string;
  deviceType?: string;
  relayOn: boolean;
  isOffline: boolean;
  commandCooldownMs?: number;
  onSendRelayCommand: (nextValue: boolean) => Promise<void>;
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

export function DeviceControlPanel({
  deviceName,
  deviceType,
  relayOn,
  isOffline,
  commandCooldownMs = 0,
  onSendRelayCommand
}: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);

  useEffect(() => {
    if (cooldownRemainingSeconds <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCooldownRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemainingSeconds]);

  const cooldownSeconds = useMemo(
    () => Math.max(0, Math.ceil(commandCooldownMs / 1000)),
    [commandCooldownMs]
  );
  const isCoolingDown = cooldownRemainingSeconds > 0;
  const isBusy = status === "sending";
  const isControlLocked = isOffline || isBusy || isCoolingDown;

  async function toggle() {
    if (isControlLocked) return;
    const next = !relayOn;
    const action = next ? "开启" : "关闭";
    setStatus("sending");
    setErrMsg("");
    setLastAction(null);
    try {
      await onSendRelayCommand(next);
      setStatus("ok");
      setLastAction(`${action}成功`);
      if (cooldownSeconds > 0) {
        setCooldownRemainingSeconds(cooldownSeconds);
      }
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("fail");
      setErrMsg(e instanceof Error ? e.message : "命令失败");
      setLastAction(`${action}失败`);
    }
  }

  const icon = getDeviceIcon(deviceType);
  const buttonText = isBusy
    ? "⏳ 发送中..."
    : isCoolingDown
      ? `⏱️ 冷却 ${cooldownRemainingSeconds}s`
      : relayOn
        ? "🔴 关闭"
        : "🟢 开启";
  const commandStatusText =
    status === "sending"
      ? "发送中..."
      : status === "ok"
        ? "✅ 已确认"
        : status === "fail"
          ? "❌ 失败"
          : lastAction || "就绪";

  return (
    <section className="surface-panel control-card">
      <div className="control-card__header">
        <div className="control-card__identity">
          <span className="control-card__icon">{icon}</span>
          <div>
            <p className="info-label">设备控制</p>
            <h2 className="page-section-title control-card__title">{deviceName}</h2>
          </div>
        </div>
        <div className="control-card__actions">
          <div className={`relay-state-pill ${relayOn ? "relay-state-pill--on" : "relay-state-pill--off"}`}>
            {relayOn ? "🟢 已开启" : "⚫ 已关闭"}
          </div>
          <button
            onClick={toggle}
            disabled={isControlLocked}
            className={`command-toggle-button ${isOffline ? "command-toggle-button--offline" : ""}`}
          >
            {buttonText}
          </button>
        </div>
      </div>

      {isCoolingDown ? (
        <div className="cooldown-callout" aria-live="polite">
          <div>
            <strong>控制冷却 {cooldownRemainingSeconds}s</strong>
            <p>上一条命令正在稳定状态，暂缓重复下发，避免继电器短时间抖动。</p>
          </div>
          <div className="cooldown-callout__track">
            <span
              style={{
                width: `${Math.max(8, (cooldownRemainingSeconds / Math.max(cooldownSeconds, 1)) * 100)}%`
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="metric-grid control-card__metrics">
        <article className="soft-card">
          <div className="info-label">继电器状态</div>
          <strong className="info-value info-value--xl">{relayOn ? "开" : "关"}</strong>
        </article>
        <article className="soft-card">
          <div className="info-label">命令状态</div>
          <strong className="info-value info-value--md">
            {commandStatusText}
          </strong>
        </article>
        <article className="soft-card">
          <div className="info-label">设备状态</div>
          <strong className={`info-value info-value--md ${isOffline ? "info-value--danger" : "info-value--success"}`}>
            {isOffline ? "🔴 离线" : "🟢 在线"}
          </strong>
        </article>
      </div>

      {errMsg && (
        <div className="inline-alert inline-alert--danger">
          <span>⚠️</span>
          <span>错误: {errMsg}</span>
        </div>
      )}
    </section>
  );
}

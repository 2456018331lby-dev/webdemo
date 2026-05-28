"use client";

import React, { useState } from "react";

type Props = {
  deviceName: string;
  initialRelayOn: boolean;
  isOffline: boolean;
  onSendRelayCommand: (nextValue: boolean) => Promise<void>;
};

export function DeviceControlPanel({ deviceName, initialRelayOn, isOffline, onSendRelayCommand }: Props) {
  const [relayOn, setRelayOn] = useState(initialRelayOn);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function toggle() {
    if (isOffline || status === "sending") return;
    const next = !relayOn;
    setStatus("sending");
    setErrMsg("");
    try {
      await onSendRelayCommand(next);
      setRelayOn(next);
      setStatus("ok");
    } catch (e) {
      setStatus("fail");
      setErrMsg(e instanceof Error ? e.message : "命令失败");
    }
  }

  return (
    <section className="surface-panel" style={{ background: "var(--bg-panel)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p className="info-label">设备控制</p>
          <h2 className="page-section-title" style={{ marginTop: "6px", fontSize: "26px" }}>{deviceName}</h2>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", color: "var(--text-body)" }}>
            当前: <strong style={{ color: "var(--text-strong)" }}>{relayOn ? "开" : "关"}</strong>
          </span>
          <button
            onClick={toggle}
            disabled={isOffline || status === "sending"}
            className={isOffline ? "secondary-cta" : "primary-cta"}
            style={{
              border: 0, cursor: isOffline || status === "sending" ? "not-allowed" : "pointer",
              opacity: isOffline ? 0.6 : status === "sending" ? 0.7 : 1,
              fontSize: "16px", padding: "14px 22px"
            }}
          >
            {status === "sending" ? "发送中..." : relayOn ? "关闭" : "开启"}
          </button>
        </div>
      </div>

      <div className="metric-grid" style={{ marginTop: "20px" }}>
        <article className="soft-card">
          <div className="info-label">继电器状态</div>
          <strong className="info-value" style={{ fontSize: "28px" }}>{relayOn ? "开" : "关"}</strong>
        </article>
        <article className="soft-card">
          <div className="info-label">命令状态</div>
          <strong className="info-value" style={{ fontSize: "20px" }}>
            {status === "idle" && "就绪"}
            {status === "sending" && "发送中"}
            {status === "ok" && "已确认"}
            {status === "fail" && "失败"}
          </strong>
        </article>
      </div>

      {errMsg && (
        <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "12px", background: "rgba(180,52,52,0.08)", color: "#9f2525", fontSize: "14px" }}>
          错误: {errMsg}
        </div>
      )}
    </section>
  );
}
"use client";

import React from "react";
import { useState, useTransition } from "react";

type DeviceControlPanelProps = {
  deviceName: string;
  initialRelayOn: boolean;
  isOffline: boolean;
  onSendRelayCommand: (nextValue: boolean) => Promise<void>;
};

type CommandStatus = "idle" | "pending" | "acknowledged" | "failed";

export function DeviceControlPanel({
  deviceName,
  initialRelayOn,
  isOffline,
  onSendRelayCommand
}: DeviceControlPanelProps) {
  const [relayOn, setRelayOn] = useState(initialRelayOn);
  const [status, setStatus] = useState<CommandStatus>("idle");
  const [isTransitionPending, startTransition] = useTransition();

  async function handleToggle() {
    if (isOffline) {
      return;
    }

    const nextRelayValue = !relayOn;

    setStatus("pending");

    try {
      await onSendRelayCommand(nextRelayValue);

      startTransition(() => {
        setRelayOn(nextRelayValue);
        setStatus("acknowledged");
      });
    } catch {
      setStatus("failed");
    }
  }

  const buttonLabel = relayOn ? "Turn relay off" : "Turn relay on";

  return (
    <section
      style={{
        borderRadius: "24px",
        padding: "24px",
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(21, 48, 65, 0.08)",
        boxShadow: "0 14px 38px rgba(21, 48, 65, 0.10)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#61839a" }}>
            Device Control
          </p>
          <h2 style={{ margin: "8px 0 4px", fontSize: "28px", lineHeight: 1.1 }}>{deviceName}</h2>
          <p style={{ margin: 0, color: "#4b6678", lineHeight: 1.5 }}>
            Relay state is tracked separately from the command lifecycle so the UI can show pending and acknowledged states clearly.
          </p>
        </div>
        <span
          style={{
            alignSelf: "center",
            padding: "8px 12px",
            borderRadius: "999px",
            background: isOffline ? "rgba(180, 52, 52, 0.12)" : "rgba(25, 141, 85, 0.12)",
            color: isOffline ? "#9f2525" : "#16653f",
            fontWeight: 600,
            fontSize: "13px"
          }}
        >
          {isOffline ? "Offline" : "Online"}
        </span>
      </div>

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gap: "18px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <article
          style={{
            borderRadius: "18px",
            padding: "18px",
            background: "#f2f7fa",
            border: "1px solid rgba(21, 48, 65, 0.06)"
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#5f7f92", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Reported relay state
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "32px", fontWeight: 700 }}>
            {relayOn ? "On" : "Off"}
          </p>
        </article>

        <article
          style={{
            borderRadius: "18px",
            padding: "18px",
            background: "#f2f7fa",
            border: "1px solid rgba(21, 48, 65, 0.06)"
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#5f7f92", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Command status
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "20px", fontWeight: 700 }}>
            {status === "idle" && "Ready"}
            {status === "pending" && "Pending"}
            {status === "acknowledged" && "Acknowledged"}
            {status === "failed" && "Failed"}
          </p>
        </article>
      </div>

      <div style={{ marginTop: "24px", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isOffline || status === "pending" || isTransitionPending}
          aria-label={buttonLabel}
          style={{
            border: 0,
            borderRadius: "16px",
            padding: "14px 20px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: isOffline ? "not-allowed" : "pointer",
            background: isOffline ? "#d7dde1" : "#153041",
            color: isOffline ? "#6b7a84" : "#ffffff"
          }}
        >
          {buttonLabel}
        </button>

        <p style={{ margin: 0, fontSize: "14px", color: "#456072" }}>
          {isOffline && "Device is offline"}
          {!isOffline && status === "pending" && "Pending hardware acknowledgement"}
          {!isOffline && status === "acknowledged" && "Hardware acknowledged the new relay state"}
          {!isOffline && status === "failed" && "Command failed before the hardware acknowledged it"}
          {!isOffline && status === "idle" && "Ready to send a relay command"}
        </p>
      </div>
    </section>
  );
}

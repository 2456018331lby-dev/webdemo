import React from "react";

type CommandHistoryEntry = {
  commandId: string;
  commandType: string;
  status: string;
  requestedAt: string;
};

type CommandHistoryListProps = {
  telemetryNote: string;
  history: CommandHistoryEntry[];
};

type StatusTone = {
  tone: "queued" | "inflight" | "success" | "danger" | "warning" | "neutral";
  label: string;
  background: string;
  color: string;
};

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case "queued":
      return {
        tone: "queued",
        label: "queued",
        background: "rgba(40, 118, 165, 0.12)",
        color: "#225f88"
      };
    case "delivered":
      return {
        tone: "inflight",
        label: "delivered",
        background: "rgba(128, 92, 24, 0.14)",
        color: "#7a5615"
      };
    case "acknowledged":
      return {
        tone: "success",
        label: "acknowledged",
        background: "rgba(25, 141, 85, 0.12)",
        color: "#16653f"
      };
    case "failed":
      return {
        tone: "danger",
        label: "failed",
        background: "rgba(180, 52, 52, 0.12)",
        color: "#9f2525"
      };
    case "timed_out":
      return {
        tone: "warning",
        label: "timed out",
        background: "rgba(181, 106, 16, 0.14)",
        color: "#8c580d"
      };
    default:
      return {
        tone: "neutral",
        label: status,
        background: "rgba(72, 94, 109, 0.12)",
        color: "#415564"
      };
  }
}

export function CommandHistoryList({ telemetryNote, history }: CommandHistoryListProps) {
  return (
    <section
      style={{
        borderRadius: "24px",
        padding: "24px",
        background: "rgba(255,255,255,0.88)",
        border: "1px solid rgba(21, 48, 65, 0.08)",
        boxShadow: "0 18px 60px rgba(21, 48, 65, 0.08)"
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>Recent command history</h2>
      <p style={{ margin: "0 0 18px", color: "#456072" }}>Latest telemetry note: {telemetryNote}</p>

      <div style={{ display: "grid", gap: "12px" }}>
        {history.length === 0 ? (
          <div style={{ color: "#628196" }}>No commands have been sent yet.</div>
        ) : (
          history.map((entry) => {
            const statusTone = getStatusTone(entry.status);

            return (
              <article
                key={entry.commandId}
                style={{
                  borderRadius: "16px",
                  padding: "14px 16px",
                  background: "#f4f8fb",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center"
                }}
              >
                <div>
                  <strong>{entry.commandType}</strong>
                  <p style={{ margin: "6px 0 0", color: "#5e7d91", fontSize: "14px" }}>
                    Requested at {new Date(entry.requestedAt).toLocaleTimeString()}
                  </p>
                </div>
                <span
                  data-status-tone={statusTone.tone}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: statusTone.background,
                    color: statusTone.color,
                    fontWeight: 700,
                    fontSize: "12px",
                    textTransform: "uppercase"
                  }}
                >
                  {statusTone.label}
                </span>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

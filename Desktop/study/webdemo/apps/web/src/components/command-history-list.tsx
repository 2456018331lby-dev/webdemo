import React, { useMemo } from "react";

type CommandHistoryEntry = {
  commandId: string;
  commandType: string;
  status: string;
  requestedAt: string;
  attemptCount?: number;
  nextRetryAt?: string | null;
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

function formatRetryNote(entry: CommandHistoryEntry) {
  const parts: string[] = [];

  if (typeof entry.attemptCount === "number" && entry.attemptCount > 1) {
    parts.push(`Attempt ${entry.attemptCount}`);
  }

  if (entry.nextRetryAt) {
    parts.push(`Retry after ${new Date(entry.nextRetryAt).toLocaleTimeString()}`);
  }

  return parts.join(" · ");
}

export function CommandHistoryList({ telemetryNote, history }: CommandHistoryListProps) {
  const lifecycleSummary = useMemo(() => {
    if (history.length === 0) return null;

    const latest = history[0];
    const timedOutCount = history.filter((e) => e.status === "timed_out").length;
    const failedCount = history.filter((e) => e.status === "failed").length;
    const retryingCount = history.filter((e) => e.status === "queued" && (e.attemptCount ?? 1) > 1).length;

    const parts: string[] = [];
    if (latest.status === "timed_out") {
      parts.push(`最后一条命令已超时（共 ${timedOutCount} 条超时记录）`);
      parts.push("建议检查 ESP32S3 → STM32H743 链路");
    } else if (latest.status === "failed") {
      parts.push(`最后一条命令失败（共 ${failedCount} 条失败记录）`);
      parts.push("建议检查供电、负载或 payload 合法性");
    } else if (latest.status === "queued" && (latest.attemptCount ?? 1) > 1) {
      parts.push(`命令正在重试中（共 ${retryingCount} 条重试中记录）`);
      if (latest.nextRetryAt) {
        parts.push(`下次重试: ${new Date(latest.nextRetryAt).toLocaleTimeString()}`);
      }
    } else if (latest.status === "acknowledged") {
      parts.push("最近命令已完成，链路正常");
    } else if (latest.status === "delivered") {
      parts.push("命令已送达，等待硬件确认中");
    }

    return parts.length > 0 ? parts : null;
  }, [history]);

  return (
    <section className="surface-panel" style={{ background: "rgba(255,255,255,0.88)" }}>
      <h2 className="page-section-title" style={{ fontSize: "24px" }}>Recent command history</h2>
      <p className="page-section-copy" style={{ marginTop: "10px" }}>Latest telemetry note: {telemetryNote}</p>

      {lifecycleSummary ? (
        <div
          style={{
            marginTop: "14px",
            borderRadius: "12px",
            padding: "12px 16px",
            background: history[0]?.status === "timed_out"
              ? "rgba(181, 106, 16, 0.12)"
              : history[0]?.status === "failed"
                ? "rgba(180, 52, 52, 0.10)"
                : history[0]?.status === "queued" && (history[0]?.attemptCount ?? 1) > 1
                  ? "rgba(40, 118, 165, 0.10)"
                  : "rgba(25, 141, 85, 0.08)",
            border: `1px solid ${
              history[0]?.status === "timed_out"
                ? "rgba(181, 106, 16, 0.25)"
                : history[0]?.status === "failed"
                  ? "rgba(180, 52, 52, 0.22)"
                  : history[0]?.status === "queued" && (history[0]?.attemptCount ?? 1) > 1
                    ? "rgba(40, 118, 165, 0.22)"
                    : "rgba(25, 141, 85, 0.20)"
            }`
          }}
        >
          {lifecycleSummary.map((line, idx) => (
            <p key={idx} className="info-copy" style={{ marginTop: idx === 0 ? 0 : "4px", color: "#27465d" }}>
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
        {history.length === 0 ? (
          <div className="page-section-copy" style={{ marginTop: 0 }}>No commands have been sent yet.</div>
        ) : (
          history.map((entry) => {
            const statusTone = getStatusTone(entry.status);
            const retryNote = formatRetryNote(entry);

            return (
              <article
                key={entry.commandId}
                style={{
                  borderRadius: "16px",
                  padding: "14px 16px",
                  background: "var(--bg-soft)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-strong)" }}>{entry.commandType}</strong>
                  <p className="info-copy" style={{ marginTop: "6px", fontSize: "14px" }}>
                    Requested at {new Date(entry.requestedAt).toLocaleTimeString()}
                  </p>
                  {retryNote ? (
                    <p className="info-copy" style={{ marginTop: "6px", fontSize: "13px" }}>{retryNote}</p>
                  ) : null}
                </div>
                <span
                  data-status-tone={statusTone.tone}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-pill)",
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

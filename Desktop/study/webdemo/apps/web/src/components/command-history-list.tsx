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
};

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case "queued":
      return {
        tone: "queued",
        label: "排队中"
      };
    case "delivered":
      return {
        tone: "inflight",
        label: "已送达"
      };
    case "acknowledged":
      return {
        tone: "success",
        label: "已确认"
      };
    case "failed":
      return {
        tone: "danger",
        label: "失败"
      };
    case "timed_out":
      return {
        tone: "warning",
        label: "已超时"
      };
    default:
      return {
        tone: "neutral",
        label: status
      };
  }
}

function formatRetryNote(entry: CommandHistoryEntry) {
  const parts: string[] = [];

  if (typeof entry.attemptCount === "number" && entry.attemptCount > 1) {
    parts.push(`第 ${entry.attemptCount} 次尝试`);
  }

  if (entry.nextRetryAt) {
    parts.push(`重试时间: ${new Date(entry.nextRetryAt).toLocaleTimeString("zh-CN")}`);
  }

  return parts.join(" · ");
}

function formatCommandType(type: string): string {
  switch (type) {
    case "relay.set": return "继电器控制";
    case "sensor.read": return "传感器读取";
    case "device.restart": return "设备重启";
    default: return type;
  }
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
        parts.push(`下次重试: ${new Date(latest.nextRetryAt).toLocaleTimeString("zh-CN")}`);
      }
    } else if (latest.status === "acknowledged") {
      parts.push("最近命令已完成，链路正常");
    } else if (latest.status === "delivered") {
      parts.push("命令已送达，等待硬件确认中");
    }

    return parts.length > 0 ? parts : null;
  }, [history]);

  const lifecycleTone: StatusTone["tone"] =
    history[0]?.status === "timed_out"
      ? "warning"
      : history[0]?.status === "failed"
        ? "danger"
        : history[0]?.status === "queued" && (history[0]?.attemptCount ?? 1) > 1
          ? "queued"
          : "success";

  return (
    <section className="surface-panel">
      <h2 className="page-section-title page-section-title--sm">命令历史</h2>
      <p className="page-section-copy command-history__telemetry">
        最新遥测: {telemetryNote || "暂无数据"}
      </p>

      {lifecycleSummary ? (
        <div className="lifecycle-summary" data-status-tone={lifecycleTone}>
          {lifecycleSummary.map((line, idx) => (
            <p
              key={idx}
              className={`info-copy lifecycle-summary__line ${idx === 0 ? "lifecycle-summary__line--primary" : ""}`}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="command-history__list">
        {history.length === 0 ? (
          <div className="page-section-copy command-history__empty">暂无命令记录</div>
        ) : (
          history.map((entry) => {
            const statusTone = getStatusTone(entry.status);
            const retryNote = formatRetryNote(entry);

            return (
              <article
                key={entry.commandId}
                className="device-list-item command-history__item fade-in"
              >
                <div>
                  <strong className="command-history__type">{formatCommandType(entry.commandType)}</strong>
                  <p className="info-copy command-history__time">
                    请求时间: {new Date(entry.requestedAt).toLocaleTimeString("zh-CN")}
                  </p>
                  {retryNote ? (
                    <p className="info-copy command-history__retry">{retryNote}</p>
                  ) : null}
                </div>
                <span
                  className="status-tag"
                  data-status-tone={statusTone.tone}
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

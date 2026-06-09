import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandHistoryList } from "./command-history-list";

describe("CommandHistoryList", () => {
  it("renders distinct status tones for each lifecycle state", () => {
    render(
      <CommandHistoryList
        telemetryNote="最后心跳 10 秒前"
        history={[
          {
            commandId: "cmd-queued",
            commandType: "relay.set",
            status: "queued",
            requestedAt: "2026-05-10T09:00:00Z",
            attemptCount: 2,
            nextRetryAt: "2026-05-10T09:00:05Z"
          },
          {
            commandId: "cmd-delivered",
            commandType: "relay.set",
            status: "delivered",
            requestedAt: "2026-05-10T09:00:02Z"
          },
          {
            commandId: "cmd-ack",
            commandType: "relay.set",
            status: "acknowledged",
            requestedAt: "2026-05-10T09:00:04Z"
          },
          {
            commandId: "cmd-failed",
            commandType: "relay.set",
            status: "failed",
            requestedAt: "2026-05-10T09:00:06Z"
          },
          {
            commandId: "cmd-timeout",
            commandType: "relay.set",
            status: "timed_out",
            requestedAt: "2026-05-10T09:00:08Z"
          }
        ]}
      />
    );

    expect(screen.getByText(/最后心跳 10 秒前/)).toBeInTheDocument();
    expect(screen.getByText("排队中")).toHaveAttribute("data-status-tone", "queued");
    expect(screen.getByText("已送达")).toHaveAttribute("data-status-tone", "inflight");
    expect(screen.getByText("已确认")).toHaveAttribute("data-status-tone", "success");
    expect(screen.getByText("失败")).toHaveAttribute("data-status-tone", "danger");
    expect(screen.getByText("已超时")).toHaveAttribute("data-status-tone", "warning");
    expect(screen.getByText(/第 2 次尝试/)).toBeInTheDocument();
    expect(screen.getByText(/重试时间/)).toBeInTheDocument();
  });

  it("shows retry metadata only for commands that actually need it", () => {
    render(
      <CommandHistoryList
        telemetryNote="温度 24.6°C, 信号强度 -61 dBm"
        history={[
          {
            commandId: "cmd-normal",
            commandType: "relay.set",
            status: "acknowledged",
            requestedAt: "2026-05-10T09:00:04Z"
          }
        ]}
      />
    );

    expect(screen.queryByText(/次尝试/)).not.toBeInTheDocument();
    expect(screen.queryByText(/重试时间/)).not.toBeInTheDocument();
  });
});

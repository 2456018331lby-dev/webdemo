import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandHistoryList } from "./command-history-list";

describe("CommandHistoryList", () => {
  it("renders distinct status tones for each lifecycle state", () => {
    render(
      <CommandHistoryList
        telemetryNote="Last heartbeat 10 seconds ago"
        history={[
          {
            commandId: "cmd-queued",
            commandType: "relay.set",
            status: "queued",
            requestedAt: "2026-05-10T09:00:00Z"
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

    expect(screen.getByText(/Last heartbeat 10 seconds ago/)).toBeInTheDocument();
    expect(screen.getByText("queued")).toHaveAttribute("data-status-tone", "queued");
    expect(screen.getByText("delivered")).toHaveAttribute("data-status-tone", "inflight");
    expect(screen.getByText("acknowledged")).toHaveAttribute("data-status-tone", "success");
    expect(screen.getByText("failed")).toHaveAttribute("data-status-tone", "danger");
    expect(screen.getByText("timed out")).toHaveAttribute("data-status-tone", "warning");
  });
});

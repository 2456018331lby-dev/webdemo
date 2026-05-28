import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceCommandClient } from "./device-command-client";

const queuedCmd = { commandId: "cmd-1", commandType: "relay.set", status: "queued" as const, requestedAt: "2026-05-10T09:00:00Z", attemptCount: 2, nextRetryAt: "2026-05-10T09:00:05Z" };

describe("DeviceCommandClient", () => {
  it("renders metrics from SSR data without polling", () => {
    render(<DeviceCommandClient deviceId="d1" deviceName="Main Light" initialRelayOn={false} isOffline={false} initialHistory={[queuedCmd]} initialTelemetry="Temp 25 C" />);
    expect(screen.getAllByText("可靠度").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("操作风险")).toBeInTheDocument();
    expect(screen.getByText("冷却时间")).toBeInTheDocument();
    expect(screen.getByText(/等待重试/)).toBeInTheDocument();
  });

  it("shows retry attempt count from SSR data", () => {
    render(<DeviceCommandClient deviceId="d1" deviceName="Main Light" initialRelayOn={true} isOffline={false} initialHistory={[queuedCmd]} initialTelemetry="RSSI -61 dBm" />);
    expect(screen.getByText(/第 2 次/)).toBeInTheDocument();
  });

  it("shows offline message", () => {
    render(<DeviceCommandClient deviceId="d1" deviceName="Main Light" initialRelayOn={false} isOffline={true} initialHistory={[]} initialTelemetry="" />);
    expect(screen.getByText(/设备离线/)).toBeInTheDocument();
  });
});
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeviceCommandClient } from "./device-command-client";

const queuedCmd = { commandId: "cmd-1", commandType: "relay.set", status: "queued" as const, requestedAt: "2026-05-10T09:00:00Z", attemptCount: 2, nextRetryAt: "2026-05-10T09:00:05Z" };

describe("DeviceCommandClient", () => {
  it("renders metrics from SSR data without polling", () => {
    render(<DeviceCommandClient deviceId="d1" homeName="温馨公寓" roomName="客厅" deviceName="主灯" deviceType="relay-controller" initialRelayOn={false} isOffline={false} initialHistory={[queuedCmd]} initialTelemetry="温度 25°C" />);
    expect(screen.getAllByText("可靠度").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("操作风险")).toBeInTheDocument();
    expect(screen.getByText("冷却时间")).toBeInTheDocument();
    expect(screen.getByText(/等待重试/)).toBeInTheDocument();
  });

  it("shows retry attempt count from SSR data", () => {
    render(<DeviceCommandClient deviceId="d1" homeName="温馨公寓" roomName="客厅" deviceName="主灯" deviceType="relay-controller" initialRelayOn={true} isOffline={false} initialHistory={[queuedCmd]} initialTelemetry="信号强度 -61 dBm" />);
    const retryElements = screen.getAllByText(/第 2 次/);
    expect(retryElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows offline message", () => {
    render(<DeviceCommandClient deviceId="d1" homeName="温馨公寓" roomName="客厅" deviceName="主灯" deviceType="relay-controller" initialRelayOn={false} isOffline={true} initialHistory={[]} initialTelemetry="" />);
    const offlineMessages = screen.getAllByText(/设备离线/);
    expect(offlineMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the hero summary in sync after a successful relay toggle", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        state: {
          relayOn: false,
          online: true,
          lastTelemetry: "温度 24.1°C"
        },
        commandHistory: [
          {
            commandId: "cmd-2",
            commandType: "relay.set",
            status: "acknowledged",
            requestedAt: "2026-05-10T09:01:00Z"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DeviceCommandClient
        deviceId="d1"
        homeName="温馨公寓"
        roomName="客厅"
        deviceName="主灯"
        deviceType="relay-controller"
        initialRelayOn={true}
        isOffline={false}
        initialHistory={[]}
        initialTelemetry="温度 25°C"
      />
    );

    expect(screen.getByText(/继电器控制器 · 已开启 · 在线/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /关闭/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/devices/d1/commands",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/继电器控制器 · 已关闭 · 在线/)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("treats simulator ack ok as confirmed even when the returned command snapshot is queued", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        command: {
          commandId: "cmd-ack-1",
          commandType: "relay.set",
          status: "queued",
          requestedAt: "2026-05-10T09:01:00Z"
        },
        ack: {
          result: "ok"
        },
        state: {
          relayOn: true,
          online: true,
          lastTelemetry: "温度 24.1°C"
        },
        commandHistory: [
          {
            commandId: "cmd-ack-1",
            commandType: "relay.set",
            status: "acknowledged",
            requestedAt: "2026-05-10T09:01:00Z"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DeviceCommandClient
        deviceId="d1"
        homeName="温馨公寓"
        roomName="客厅"
        deviceName="主灯"
        deviceType="relay-controller"
        initialRelayOn={false}
        isOffline={false}
        initialHistory={[]}
        initialTelemetry="温度 25°C"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /开启/ }));

    await waitFor(() => {
      expect(screen.getAllByText(/已确认/).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryByText(/等待硬件确认/)).not.toBeInTheDocument();
    expect(screen.getByText(/继电器控制器 · 已开启 · 在线/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("shows a queued command outcome for polling delivery mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        deliveryMode: "polling",
        command: {
          commandId: "cmd-polling-1",
          commandType: "relay.set",
          status: "queued",
          requestedAt: "2026-05-10T09:02:00Z"
        },
        state: {
          relayOn: false,
          online: true,
          lastTelemetry: "温度 24.1°C"
        },
        commandHistory: [
          {
            commandId: "cmd-polling-1",
            commandType: "relay.set",
            status: "queued",
            requestedAt: "2026-05-10T09:02:00Z"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DeviceCommandClient
        deviceId="d1"
        homeName="温馨公寓"
        roomName="客厅"
        deviceName="主灯"
        deviceType="relay-controller"
        initialRelayOn={false}
        isOffline={false}
        initialHistory={[]}
        initialTelemetry="温度 25°C"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /开启/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/devices/d1/commands",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/已排队/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/已确认/)).not.toBeInTheDocument();
    expect(screen.getByText(/等待硬件确认/)).toBeInTheDocument();
    expect(screen.getByText(/继电器控制器 · 已关闭 · 在线/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

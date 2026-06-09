import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesClient } from "./homes-client";

const initialHomes = [
  {
    id: "home-01",
    name: "温馨公寓",
    memberRole: "owner",
    deviceCount: 2,
    offlineCount: 1,
    timedOutCount: 0,
    failedCount: 0,
    retryingCount: 0,
    evaluatedAt: "2026-06-08T01:00:00.000Z",
    rooms: [
      {
        id: "room-living",
        name: "客厅",
        devices: [
          {
            id: "device-relay-01",
            name: "主灯继电器",
            type: "relay-controller",
            online: true,
            relayOn: true,
            lastTelemetry: "温度 24.6°C",
            latestCommandStatus: "acknowledged",
            attemptCount: 1,
            nextRetryAt: null
          },
          {
            id: "device-relay-02",
            name: "排风扇继电器",
            type: "relay-controller",
            online: false,
            relayOn: false,
            lastTelemetry: "最后心跳 2 分钟前",
            latestCommandStatus: null,
            attemptCount: null,
            nextRetryAt: null
          }
        ]
      }
    ]
  }
];

const refreshedHomes = [
  {
    ...initialHomes[0],
    deviceCount: 3,
    offlineCount: 0,
    timedOutCount: 1,
    evaluatedAt: "2026-06-08T02:30:00.000Z",
    rooms: [
      {
        ...initialHomes[0].rooms[0],
        devices: [
          {
            ...initialHomes[0].rooms[0].devices[0],
            latestCommandStatus: "timed_out"
          },
          {
            ...initialHomes[0].rooms[0].devices[1],
            online: true
          },
          {
            id: "device-sensor-01",
            name: "温湿度传感器",
            type: "environment-sensor",
            online: true,
            relayOn: false,
            lastTelemetry: "湿度 48.1%",
            latestCommandStatus: null,
            attemptCount: null,
            nextRetryAt: null
          }
        ]
      }
    ]
  }
];

describe("HomesClient", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("refreshes the global snapshot on demand", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ homes: refreshedHomes })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<HomesClient initialHomes={initialHomes} />);

    expect(screen.getByText(hasTextContent("2 台设备 · 1 离线 · 0 超时 · 0 失败"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/homes/snapshot", { cache: "no-store" });
    });

    await waitFor(() => {
      expect(screen.getByText(hasTextContent("3 台设备 · 0 离线 · 1 超时 · 0 失败"))).toBeInTheDocument();
    });

    expect(screen.getByRole("status")).toHaveTextContent("最近更新");
    expect(screen.getByText("温湿度传感器")).toBeInTheDocument();
    expect(screen.getByText("已超时")).toBeInTheDocument();
  });

  it("keeps the last snapshot visible when manual refresh fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));

    vi.stubGlobal("fetch", fetchMock);

    render(<HomesClient initialHomes={initialHomes} />);

    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("刷新失败，继续显示上次快照");
    });

    expect(screen.getByText(hasTextContent("2 台设备 · 1 离线 · 0 超时 · 0 失败"))).toBeInTheDocument();
    expect(screen.getByText("排风扇继电器")).toBeInTheDocument();
  });
});

function hasTextContent(expected: string) {
  return (_content: string, element: Element | null) => element?.textContent === expected;
}

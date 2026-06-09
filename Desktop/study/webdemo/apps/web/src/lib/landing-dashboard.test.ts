import { describe, expect, it } from "vitest";
import { buildLandingDashboardSummary } from "./landing-dashboard";
import type { DeviceCommandRecord, DeviceStateRecord } from "./server/device-backend";
import type { HomeSummary } from "./mock-data";

function command(deviceId: string, status: DeviceCommandRecord["status"], attemptCount = 1): DeviceCommandRecord {
  return {
    commandId: `${deviceId}-${status}`,
    deviceId,
    correlationId: `${deviceId}-${status}-correlation`,
    commandType: "relay.set",
    payload: { relayOn: true },
    requestedAt: "2026-06-08T08:00:00.000Z",
    status,
    attemptCount,
    nextRetryAt: null
  };
}

const homes: HomeSummary[] = [
  {
    id: "home-qa",
    name: "QA 公寓",
    memberRole: "owner",
    rooms: [
      {
        id: "room-living",
        name: "客厅",
        devices: [
          {
            id: "device-a",
            name: "旧在线设备",
            type: "relay-controller",
            online: true,
            relayOn: false,
            lastTelemetry: "静态遥测"
          },
          {
            id: "device-b",
            name: "运行中传感器",
            type: "environment-sensor",
            online: false,
            relayOn: false,
            lastTelemetry: "静态传感器"
          }
        ]
      }
    ]
  }
];

describe("buildLandingDashboardSummary", () => {
  it("uses runtime state for counts and featured room devices", async () => {
    const states = new Map<string, DeviceStateRecord>([
      [
        "device-a",
        {
          deviceId: "device-a",
          relayOn: false,
          lastTelemetry: "最后心跳 5 分钟前",
          online: false,
          updatedAt: "2026-06-08T08:00:00.000Z"
        }
      ],
      [
        "device-b",
        {
          deviceId: "device-b",
          relayOn: false,
          lastTelemetry: "CO2 430ppm",
          online: true,
          updatedAt: "2026-06-08T08:01:00.000Z"
        }
      ]
    ]);
    const history = new Map<string, DeviceCommandRecord[]>([
      ["device-a", [command("device-a", "timed_out")]],
      ["device-b", [command("device-b", "queued", 2)]]
    ]);

    const summary = await buildLandingDashboardSummary(homes, {
      getDeviceState: async (deviceId) => states.get(deviceId) ?? null,
      getCommandHistory: async (deviceId) => history.get(deviceId) ?? []
    });

    expect(summary.totalDevices).toBe(2);
    expect(summary.onlineDevices).toBe(1);
    expect(summary.offlineDevices).toBe(1);
    expect(summary.timedOutCommands).toBe(1);
    expect(summary.retryingCommands).toBe(1);
    expect(summary.attentionDevices).toBe(2);
    expect(summary.roomFocus).toEqual([
      expect.objectContaining({
        featuredDeviceId: "device-b",
        featuredDeviceName: "运行中传感器",
        featuredTelemetry: "CO2 430ppm",
        attentionCount: 2
      })
    ]);
    expect(summary.priorityActions.map((item) => item.id)).toEqual(["offline", "timed-out"]);
  });

  it("returns a steady-state priority action when no device needs attention", async () => {
    const summary = await buildLandingDashboardSummary(homes, {
      getDeviceState: async (deviceId) => ({
        deviceId,
        relayOn: false,
        lastTelemetry: "链路正常",
        online: true,
        updatedAt: "2026-06-08T08:00:00.000Z"
      }),
      getCommandHistory: async () => [command("device-a", "acknowledged")]
    });

    expect(summary.offlineDevices).toBe(0);
    expect(summary.attentionDevices).toBe(0);
    expect(summary.priorityActions).toEqual([
      expect.objectContaining({
        id: "steady",
        href: "/devices",
        tone: "success"
      })
    ]);
  });
});

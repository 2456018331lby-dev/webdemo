import { describe, expect, it, beforeEach } from "vitest";
import {
  getCommandHistory,
  resetDeviceBackendSelection,
  getDeviceState,
  queueDeviceCommand,
  resetDeviceRuntime,
  seedDeviceState,
  simulateCommandDelivery
} from "./device-runtime";

describe("device runtime", () => {
  beforeEach(() => {
    resetDeviceBackendSelection();
    resetDeviceRuntime();
    seedDeviceState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
      online: true,
      updatedAt: "2026-05-10T09:00:00Z"
    });
  });

  it("queues a command before it is delivered", () => {
    const command = queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-1",
      payload: { channel: 1, value: true }
    });

    expect(getCommandHistory("device-relay-01")[0]).toMatchObject({
      commandId: command.commandId,
      status: "queued"
    });
  });

  it("acknowledges a simulated relay command and updates reported state", async () => {
    const command = queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-2",
      payload: { channel: 1, value: true }
    });

    const ack = await simulateCommandDelivery("device-relay-01", command.commandId);

    expect(ack.result).toBe("ok");
    expect(getCommandHistory("device-relay-01")[0]?.status).toBe("acknowledged");
    expect(getDeviceState("device-relay-01")?.relayOn).toBe(true);
  });
});

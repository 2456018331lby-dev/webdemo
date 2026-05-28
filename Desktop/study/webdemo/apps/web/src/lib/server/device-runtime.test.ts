import { describe, expect, it, beforeEach } from "vitest";
import {
  applyAckPayload,
  getCommandHistory,
  resetDeviceBackendSelection,
  getDeviceState,
  markCommandDelivered,
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

  it("queues a command before it is delivered", async () => {
    const command = queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-1",
      payload: { channel: 1, value: true }
    });

    expect((await getCommandHistory("device-relay-01"))[0]).toMatchObject({
      commandId: command.commandId,
      status: "queued"
    });
  });

  it("moves a queued command to delivered before acknowledgement", async () => {
    const command = queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-delivered",
      payload: { channel: 1, value: true }
    });

    markCommandDelivered("device-relay-01", command.commandId);

    expect((await getCommandHistory("device-relay-01"))[0]).toMatchObject({
      commandId: command.commandId,
      status: "delivered"
    });
  });

  it("marks a command as failed when the hardware rejects the ack", async () => {
    const command = queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-failed",
      payload: { channel: 1, value: true }
    });

    applyAckPayload("device-relay-01", command.commandId, {
      messageType: "ack",
      correlationId: "corr-failed",
      result: "unsafe_operation",
      reportedState: {
        relay: {
          channel: 1,
          value: false
        }
      },
      reportedAt: "2026-05-10T09:00:02Z"
    });

    expect((await getCommandHistory("device-relay-01"))[0]).toMatchObject({
      commandId: command.commandId,
      status: "failed"
    });
    expect((await getDeviceState("device-relay-01"))?.relayOn).toBe(false);
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
    expect((await getCommandHistory("device-relay-01"))[0]?.status).toBe("acknowledged");
    expect((await getDeviceState("device-relay-01"))?.relayOn).toBe(true);
  });
});

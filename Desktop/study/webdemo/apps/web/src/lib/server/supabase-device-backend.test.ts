import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import { SupabaseDeviceBackend } from "./supabase-device-backend";

describe("SupabaseDeviceBackend", () => {
  let backend: SupabaseDeviceBackend;

  beforeEach(() => {
    backend = new SupabaseDeviceBackend({
      fetchDeviceSnapshot: async (deviceId) => {
        if (deviceId !== "device-relay-01") {
          return null;
        }

        return {
          state: {
            deviceId: "device-relay-01",
            relayOn: true,
            lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
            online: true,
            updatedAt: "2026-05-10T09:00:03Z"
          },
          commandHistory: [
            {
              commandId: "cmd-002",
              deviceId: "device-relay-01",
              correlationId: "corr-002",
              commandType: "relay.set",
              payload: { channel: 1, value: true },
              requestedAt: "2026-05-10T09:00:02Z",
              status: "acknowledged"
            },
            {
              commandId: "cmd-001",
              deviceId: "device-relay-01",
              correlationId: "corr-001",
              commandType: "relay.set",
              payload: { channel: 1, value: false },
              requestedAt: "2026-05-10T09:00:01Z",
              status: "queued"
            }
          ]
        };
      }
    });
  });

  it("returns state for a known device from the injected snapshot reader", async () => {
    const state = await backend.getState("device-relay-01");

    expect(state).toEqual({
      deviceId: "device-relay-01",
      relayOn: true,
      lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
      online: true,
      updatedAt: "2026-05-10T09:00:03Z"
    });
  });

  it("returns command history for a known device from the injected snapshot reader", async () => {
    const history = await backend.getCommandHistory("device-relay-01");

    expect(history).toHaveLength(2);
    expect(history[0]?.commandId).toBe("cmd-002");
    expect(history[0]?.status).toBe("acknowledged");
  });

  it("caches snapshots between repeated reads until reset", async () => {
    const fetchDeviceSnapshot = vi.fn(async () => ({
      state: {
        deviceId: "device-relay-01",
        relayOn: false,
        lastTelemetry: "No telemetry yet",
        online: false,
        updatedAt: "2026-05-10T09:00:00Z"
      },
      commandHistory: []
    }));

    const cachedBackend = new SupabaseDeviceBackend({ fetchDeviceSnapshot });

    await cachedBackend.getState("device-relay-01");
    await cachedBackend.getCommandHistory("device-relay-01");

    expect(fetchDeviceSnapshot).toHaveBeenCalledTimes(1);

    cachedBackend.reset();
    await cachedBackend.getState("device-relay-01");

    expect(fetchDeviceSnapshot).toHaveBeenCalledTimes(2);
  });

  it("returns null and an empty history for an unknown device", async () => {
    const state = await backend.getState("device-missing");
    const history = await backend.getCommandHistory("device-missing");

    expect(state).toBeNull();
    expect(history).toEqual([]);
  });

  it("stores queued, delivered, and acknowledged state in memory for persistence-path development", async () => {
    const fetchDeviceSnapshot = vi.fn(async () => ({
      state: {
        deviceId: "device-relay-01",
        relayOn: false,
        lastTelemetry: "No telemetry yet",
        online: true,
        updatedAt: "2026-05-10T09:00:00Z"
      },
      commandHistory: []
    }));

    const writableBackend = new SupabaseDeviceBackend({
      fetchDeviceSnapshot
    });

    await writableBackend.getState("device-relay-01");

    const command: CommandRequest = {
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-write",
      payload: {
        channel: 1,
        value: true
      }
    };

    const queued = writableBackend.queueCommand(command);
    writableBackend.markCommandDelivered(command.deviceId, queued.commandId);

    const ack: AckPayload = {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "ok",
      reportedState: {
        relay: {
          channel: 1,
          value: true
        }
      },
      reportedAt: "2026-05-10T09:00:04Z"
    };

    writableBackend.applyAckPayload(command.deviceId, queued.commandId, ack);

    const state = await writableBackend.getState(command.deviceId);
    const history = await writableBackend.getCommandHistory(command.deviceId);

    expect(state).toMatchObject({
      deviceId: "device-relay-01",
      relayOn: true,
      online: true,
      updatedAt: "2026-05-10T09:00:04Z"
    });
    expect(history[0]).toMatchObject({
      commandId: queued.commandId,
      status: "acknowledged"
    });
  });

  it("simulates command delivery and produces an ack for relay commands", async () => {
    const writableBackend = new SupabaseDeviceBackend({
      fetchDeviceSnapshot: async () => ({
        state: {
          deviceId: "device-relay-01",
          relayOn: false,
          lastTelemetry: "No telemetry yet",
          online: true,
          updatedAt: "2026-05-10T09:00:00Z"
        },
        commandHistory: []
      })
    });

    const queued = writableBackend.queueCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-simulated",
      payload: {
        channel: 1,
        value: true
      }
    });

    const ack = await writableBackend.simulateCommandDelivery("device-relay-01", queued.commandId);
    const history = await writableBackend.getCommandHistory("device-relay-01");

    expect(ack.result).toBe("ok");
    expect((ack.reportedState.relay as { value?: boolean }).value).toBe(true);
    expect(history[0]?.status).toBe("acknowledged");
  });
});

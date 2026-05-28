import { beforeEach, describe, expect, it } from "vitest";
import type { CommandRequest } from "@smart-home/device-contract";
import { InMemoryDeviceBackend } from "./in-memory-device-backend";

describe("InMemoryDeviceBackend lifecycle policy", () => {
  let backend: InMemoryDeviceBackend;
  let command: CommandRequest;

  beforeEach(() => {
    backend = new InMemoryDeviceBackend();
    backend.seedState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
      online: true,
      updatedAt: "2026-05-10T09:00:00Z"
    });
    command = {
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-busy-1",
      payload: {
        channel: 1,
        value: true
      }
    };
  });

  it("requeues a busy command when retry attempts remain", () => {
    const queued = backend.queueCommand(command);

    backend.markCommandDelivered(command.deviceId, queued.commandId);
    backend.applyAckPayload(command.deviceId, queued.commandId, {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "busy",
      reportedState: {
        relay: {
          channel: 1,
          value: false
        }
      },
      reportedAt: "2026-05-10T09:00:01Z"
    });

    const history = backend.getCommandHistory(command.deviceId);

    expect(history[0]).toMatchObject({
      commandId: queued.commandId,
      status: "queued",
      attemptCount: 2
    });
  });

  it("marks a command as failed after busy retries are exhausted", () => {
    const queued = backend.queueCommand(command);

    backend.markCommandDelivered(command.deviceId, queued.commandId);
    backend.applyAckPayload(command.deviceId, queued.commandId, {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "busy",
      reportedState: {
        relay: {
          channel: 1,
          value: false
        }
      },
      reportedAt: "2026-05-10T09:00:01Z"
    });
    backend.markCommandDelivered(command.deviceId, queued.commandId);
    backend.applyAckPayload(command.deviceId, queued.commandId, {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "busy",
      reportedState: {
        relay: {
          channel: 1,
          value: false
        }
      },
      reportedAt: "2026-05-10T09:00:02Z"
    });
    backend.markCommandDelivered(command.deviceId, queued.commandId);
    backend.applyAckPayload(command.deviceId, queued.commandId, {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "busy",
      reportedState: {
        relay: {
          channel: 1,
          value: false
        }
      },
      reportedAt: "2026-05-10T09:00:03Z"
    });

    const history = backend.getCommandHistory(command.deviceId);

    expect(history[0]).toMatchObject({
      commandId: queued.commandId,
      status: "failed",
      attemptCount: 3
    });
  });

  it("marks delivered commands as timed out when timeout budget is exceeded", () => {
    const queued = backend.queueCommand(command);

    backend.markCommandDelivered(command.deviceId, queued.commandId);
    backend.applyLifecyclePolicies({
      now: new Date(new Date(queued.requestedAt).getTime() + 8000).toISOString()
    });

    const history = backend.getCommandHistory(command.deviceId);

    expect(history[0]).toMatchObject({
      commandId: queued.commandId,
      status: "timed_out"
    });
  });

  it("restores offline devices once fresh telemetry is seeded", () => {
    backend.seedState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "Last heartbeat 2 minutes ago",
      online: false,
      updatedAt: "2026-05-10T09:00:00Z"
    });

    backend.seedState({
      deviceId: "device-relay-01",
      relayOn: true,
      lastTelemetry: "Temperature 24.5 C, RSSI -58 dBm",
      online: true,
      updatedAt: "2026-05-10T09:00:05Z"
    });

    expect(backend.getState("device-relay-01")).toMatchObject({
      online: true,
      relayOn: true,
      updatedAt: "2026-05-10T09:00:05Z"
    });
  });
});

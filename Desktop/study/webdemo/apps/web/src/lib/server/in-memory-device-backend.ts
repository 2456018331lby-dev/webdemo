import { randomUUID } from "node:crypto";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import { classifyAckResult, computeRetryDelayMs, computeTimeoutTransition, shouldRetryCommand } from "@/lib/control-lifecycle";
import type {
  DeviceBackend,
  DeviceCommandRecord,
  DeviceStateRecord
} from "./device-backend";

function nowIso() {
  return new Date().toISOString();
}

const MAX_ATTEMPTS = 3;
const COMMAND_TIMEOUT_MS = 5000;

type InternalDeviceCommandRecord = DeviceCommandRecord & {
  attemptCount: number;
  nextRetryAt: string | null;
};

export class InMemoryDeviceBackend implements DeviceBackend {
  private readonly commandStore = new Map<string, InternalDeviceCommandRecord[]>();
  private readonly deviceStateStore = new Map<string, DeviceStateRecord>();

  reset() {
    this.commandStore.clear();
    this.deviceStateStore.clear();
  }

  seedState(input: DeviceStateRecord) {
    this.deviceStateStore.set(input.deviceId, input);
  }

  getState(deviceId: string) {
    return this.deviceStateStore.get(deviceId) ?? null;
  }

  getCommandHistory(deviceId: string) {
    return [...(this.commandStore.get(deviceId) ?? [])].reverse();
  }

  queueCommand(input: CommandRequest) {
    const record: InternalDeviceCommandRecord = {
      commandId: randomUUID(),
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      commandType: input.commandType,
      payload: input.payload,
      requestedAt: nowIso(),
      status: "queued",
      attemptCount: 1,
      nextRetryAt: null
    };

    const existing = this.commandStore.get(input.deviceId) ?? [];
    this.commandStore.set(input.deviceId, [...existing, record]);

    return record;
  }

  markCommandDelivered(deviceId: string, commandId: string) {
    const commands = this.commandStore.get(deviceId) ?? [];

    this.commandStore.set(
      deviceId,
      commands.map((command) =>
        command.commandId === commandId
          ? { ...command, status: "delivered", nextRetryAt: null }
          : command
      )
    );
  }

  applyAckPayload(deviceId: string, commandId: string, ack: AckPayload) {
    const commands = this.commandStore.get(deviceId) ?? [];
    const deviceState = this.deviceStateStore.get(deviceId);
    const classification = classifyAckResult(ack.result);

    this.commandStore.set(
      deviceId,
      commands.map((command) => {
        if (command.commandId !== commandId) {
          return command;
        }

        if (
          classification === "retryable" &&
          shouldRetryCommand({
            ackResult: ack.result,
            attemptsUsed: command.attemptCount,
            maxAttempts: MAX_ATTEMPTS,
            deviceOnline: deviceState?.online ?? false
          })
        ) {
          const nextAttemptCount = command.attemptCount + 1;
          const nextRetryAt = new Date(
            new Date(ack.reportedAt).getTime() + computeRetryDelayMs(nextAttemptCount)
          ).toISOString();

          return {
            ...command,
            status: "queued",
            attemptCount: nextAttemptCount,
            nextRetryAt
          };
        }

        return {
          ...command,
          status: classification === "acknowledged" ? "acknowledged" : "failed",
          nextRetryAt: null
        };
      })
    );

    const previous = this.deviceStateStore.get(deviceId);
    const relayState = ack.reportedState.relay as { value?: boolean } | undefined;

    if (previous && typeof relayState?.value === "boolean") {
      this.deviceStateStore.set(deviceId, {
        ...previous,
        relayOn: relayState.value,
        updatedAt: ack.reportedAt,
        lastTelemetry: `Last reported at ${ack.reportedAt}`,
        online: true
      });
    }
  }

  applyLifecyclePolicies(input: { now: string }) {
    this.commandStore.forEach((commands, deviceId) => {
      this.commandStore.set(
        deviceId,
        commands.map((command) => {
          const nextStatus = computeTimeoutTransition({
            status: command.status,
            requestedAt: command.requestedAt,
            now: input.now,
            timeoutMs: COMMAND_TIMEOUT_MS
          });

          return nextStatus === command.status ? command : { ...command, status: nextStatus };
        })
      );
    });
  }

  async simulateCommandDelivery(deviceId: string, commandId: string) {
    this.markCommandDelivered(deviceId, commandId);

    const commands = this.commandStore.get(deviceId) ?? [];
    const command = commands.find((entry) => entry.commandId === commandId);

    if (!command) {
      throw new Error("Command not found");
    }

    const nextRelayValue =
      typeof command.payload.value === "boolean"
        ? command.payload.value
        : this.getState(deviceId)?.relayOn ?? false;

    const ack: AckPayload = {
      messageType: "ack",
      correlationId: command.correlationId,
      result: command.correlationId.includes("busy") ? "busy" : "ok",
      reportedState: {
        relay: {
          channel: typeof command.payload.channel === "number" ? command.payload.channel : 1,
          value: nextRelayValue
        }
      },
      reportedAt: nowIso()
    };

    this.applyAckPayload(deviceId, commandId, ack);
    return ack;
  }
}

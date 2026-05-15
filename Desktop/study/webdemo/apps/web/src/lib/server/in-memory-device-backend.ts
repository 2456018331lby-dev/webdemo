import { randomUUID } from "node:crypto";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import type {
  DeviceBackend,
  DeviceCommandRecord,
  DeviceStateRecord
} from "./device-backend";

function nowIso() {
  return new Date().toISOString();
}

export class InMemoryDeviceBackend implements DeviceBackend {
  private readonly commandStore = new Map<string, DeviceCommandRecord[]>();
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
    const record: DeviceCommandRecord = {
      commandId: randomUUID(),
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      commandType: input.commandType,
      payload: input.payload,
      requestedAt: nowIso(),
      status: "queued"
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
        command.commandId === commandId ? { ...command, status: "delivered" } : command
      )
    );
  }

  applyAckPayload(deviceId: string, commandId: string, ack: AckPayload) {
    const commands = this.commandStore.get(deviceId) ?? [];

    this.commandStore.set(
      deviceId,
      commands.map((command) =>
        command.commandId === commandId
          ? {
              ...command,
              status: ack.result === "ok" ? "acknowledged" : "failed"
            }
          : command
      )
    );

    const previous = this.deviceStateStore.get(deviceId);
    const relayState = ack.reportedState.relay as { value?: boolean } | undefined;

    if (previous && typeof relayState?.value === "boolean") {
      this.deviceStateStore.set(deviceId, {
        ...previous,
        relayOn: relayState.value,
        updatedAt: ack.reportedAt
      });
    }
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
      result: "ok",
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

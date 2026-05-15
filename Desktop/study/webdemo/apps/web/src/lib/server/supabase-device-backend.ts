import { randomUUID } from "node:crypto";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DeviceBackend,
  DeviceCommandRecord,
  DeviceStateRecord
} from "./device-backend";
import { fetchDeviceSnapshotFromSupabase } from "./supabase-device-snapshot-reader";

type DeviceSnapshot = {
  state: DeviceStateRecord | null;
  commandHistory: DeviceCommandRecord[];
};

type SupabaseDeviceBackendOptions = {
  fetchDeviceSnapshot?: (deviceId: string) => Promise<DeviceSnapshot | null>;
};

function nowIso() {
  return new Date().toISOString();
}

export class SupabaseDeviceBackend implements DeviceBackend {
  private readonly fetchDeviceSnapshotImpl: (deviceId: string) => Promise<DeviceSnapshot | null>;
  private readonly snapshotCache = new Map<string, DeviceSnapshot | null>();
  private readonly commandStore = new Map<string, DeviceCommandRecord[]>();
  private readonly deviceStateStore = new Map<string, DeviceStateRecord>();

  constructor(options: SupabaseDeviceBackendOptions = {}) {
    this.fetchDeviceSnapshotImpl =
      options.fetchDeviceSnapshot ??
      (async (deviceId) => {
        const client = (await createSupabaseServerClient()) as unknown as Parameters<
          typeof fetchDeviceSnapshotFromSupabase
        >[0];
        return fetchDeviceSnapshotFromSupabase(client, deviceId);
      });
  }

  reset() {
    this.snapshotCache.clear();
    this.commandStore.clear();
    this.deviceStateStore.clear();
  }

  seedState(input: DeviceStateRecord) {
    this.deviceStateStore.set(input.deviceId, input);
    this.snapshotCache.set(input.deviceId, {
      state: input,
      commandHistory: this.commandStore.get(input.deviceId) ?? []
    });
  }

  async getState(deviceId: string) {
    const snapshot = await this.getSnapshot(deviceId);
    return snapshot?.state ?? null;
  }

  async getCommandHistory(deviceId: string) {
    const snapshot = await this.getSnapshot(deviceId);
    return snapshot?.commandHistory ?? [];
  }

  queueCommand(input: CommandRequest) {
    const existingState = this.deviceStateStore.get(input.deviceId);

    if (!existingState && this.snapshotCache.has(input.deviceId)) {
      const cached = this.snapshotCache.get(input.deviceId);

      if (cached?.state) {
        this.deviceStateStore.set(input.deviceId, cached.state);
      }
    }

    const record: DeviceCommandRecord = {
      commandId: randomUUID(),
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      commandType: input.commandType,
      payload: input.payload,
      requestedAt: nowIso(),
      status: "queued"
    };

    const commandHistory = [...(this.commandStore.get(input.deviceId) ?? [])];
    commandHistory.push(record);
    this.commandStore.set(input.deviceId, commandHistory);
    this.refreshSnapshot(input.deviceId);

    return record;
  }

  markCommandDelivered(deviceId: string, commandId: string) {
    const commandHistory = this.commandStore.get(deviceId) ?? [];

    this.commandStore.set(
      deviceId,
      commandHistory.map((command) =>
        command.commandId === commandId ? { ...command, status: "delivered" } : command
      )
    );

    this.refreshSnapshot(deviceId);
  }

  applyAckPayload(deviceId: string, commandId: string, ack: AckPayload) {
    const commandHistory = this.commandStore.get(deviceId) ?? [];

    this.commandStore.set(
      deviceId,
      commandHistory.map((command) =>
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
        updatedAt: ack.reportedAt,
        lastTelemetry: `Last reported at ${ack.reportedAt}`,
        online: true
      });
    }

    this.refreshSnapshot(deviceId);
  }

  async simulateCommandDelivery(deviceId: string, commandId: string) {
    this.markCommandDelivered(deviceId, commandId);

    const commandHistory = this.commandStore.get(deviceId) ?? [];
    const command = commandHistory.find((entry) => entry.commandId === commandId);

    if (!command) {
      throw new Error("Command not found");
    }

    const nextRelayValue =
      typeof command.payload.value === "boolean"
        ? command.payload.value
        : (await this.getState(deviceId))?.relayOn ?? false;

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

  private async getSnapshot(deviceId: string) {
    if (this.snapshotCache.has(deviceId)) {
      return this.snapshotCache.get(deviceId) ?? null;
    }

    const snapshot = await this.fetchDeviceSnapshotImpl(deviceId);

    if (snapshot?.state) {
      this.deviceStateStore.set(deviceId, snapshot.state);
    }

    if (snapshot) {
      this.commandStore.set(deviceId, [...snapshot.commandHistory].reverse());
    }

    this.snapshotCache.set(deviceId, snapshot ?? null);
    return snapshot ?? null;
  }

  private refreshSnapshot(deviceId: string) {
    const state = this.deviceStateStore.get(deviceId) ?? null;
    const commandHistory = [...(this.commandStore.get(deviceId) ?? [])].reverse();

    this.snapshotCache.set(
      deviceId,
      state || commandHistory.length > 0
        ? {
            state,
            commandHistory
          }
        : null
    );
  }
}

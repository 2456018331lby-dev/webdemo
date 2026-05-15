import type { AckPayload, CommandRequest } from "@smart-home/device-contract";

export type DeviceCommandStatus = "queued" | "delivered" | "acknowledged" | "failed" | "timed_out";

export type DeviceCommandRecord = {
  commandId: string;
  deviceId: string;
  correlationId: string;
  commandType: CommandRequest["commandType"];
  payload: CommandRequest["payload"];
  requestedAt: string;
  status: DeviceCommandStatus;
};

export type DeviceStateRecord = {
  deviceId: string;
  relayOn: boolean;
  lastTelemetry: string;
  online: boolean;
  updatedAt: string;
};

export interface DeviceBackend {
  reset(): void;
  seedState(input: DeviceStateRecord): void;
  getState(deviceId: string): DeviceStateRecord | Promise<DeviceStateRecord | null> | null;
  getCommandHistory(deviceId: string): DeviceCommandRecord[] | Promise<DeviceCommandRecord[]>;
  queueCommand(input: CommandRequest): DeviceCommandRecord;
  markCommandDelivered(deviceId: string, commandId: string): void;
  applyAckPayload(deviceId: string, commandId: string, ack: AckPayload): void;
  simulateCommandDelivery(deviceId: string, commandId: string): Promise<AckPayload>;
}

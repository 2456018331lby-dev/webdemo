import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import type { DeviceBackend, DeviceStateRecord } from "./device-backend";
import { createDeviceBackend } from "./device-backend-factory";

let deviceBackend: DeviceBackend = createDeviceBackend();

export type { DeviceCommandRecord, DeviceStateRecord } from "./device-backend";

export function setDeviceBackend(nextBackend: DeviceBackend) {
  deviceBackend = nextBackend;
}

export function getDeviceBackend() {
  return deviceBackend;
}

export function resetDeviceBackendSelection() {
  deviceBackend = createDeviceBackend();
}

export function resetDeviceRuntime() {
  deviceBackend.reset();
}

export function seedDeviceState(input: DeviceStateRecord) {
  deviceBackend.seedState(input);
}

export async function getDeviceState(deviceId: string) {
  return await deviceBackend.getState(deviceId);
}

export async function getCommandHistory(deviceId: string) {
  return await deviceBackend.getCommandHistory(deviceId);
}

export function queueDeviceCommand(input: CommandRequest) {
  return deviceBackend.queueCommand(input);
}

export function markCommandDelivered(deviceId: string, commandId: string) {
  deviceBackend.markCommandDelivered(deviceId, commandId);
}

export function applyAckPayload(deviceId: string, commandId: string, ack: AckPayload) {
  deviceBackend.applyAckPayload(deviceId, commandId, ack);
}

export async function simulateCommandDelivery(deviceId: string, commandId: string) {
  return deviceBackend.simulateCommandDelivery(deviceId, commandId);
}

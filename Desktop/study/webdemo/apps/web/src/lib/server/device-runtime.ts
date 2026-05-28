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

/**
 * ESP32S3 只知道 correlationId，不知道 commandId。
 * 此方法从命令历史中匹配 correlationId → commandId，再调用 applyAckPayload。
 */
export async function applyAckByCorrelationId(deviceId: string, correlationId: string, ack: AckPayload) {
  // 尝试后端自定义实现
  if (deviceBackend.applyAckByCorrelationId) {
    return deviceBackend.applyAckByCorrelationId(deviceId, correlationId, ack);
  }

  // 默认实现：从历史中查找 commandId
  const history = await getCommandHistory(deviceId);
  const match = history.find((cmd) => cmd.correlationId === correlationId);
  if (!match) {
    throw new Error(`No command found for correlationId: ${correlationId}`);
  }
  deviceBackend.applyAckPayload(deviceId, match.commandId, ack);
}

export function applyLifecyclePolicies(input: { now: string }) {
  return deviceBackend.applyLifecyclePolicies?.(input);
}

export async function simulateCommandDelivery(deviceId: string, commandId: string) {
  return deviceBackend.simulateCommandDelivery(deviceId, commandId);
}
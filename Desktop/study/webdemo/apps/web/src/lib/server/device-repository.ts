import type { DeviceCommandRecord, DeviceStateRecord } from "./device-backend";
import { getDeviceBackend } from "./device-runtime";

export async function getDeviceSnapshot(deviceId: string): Promise<{
  state: DeviceStateRecord | null;
  commandHistory: DeviceCommandRecord[];
}> {
  const backend = getDeviceBackend();

  return {
    state: await backend.getState(deviceId),
    commandHistory: await backend.getCommandHistory(deviceId)
  };
}

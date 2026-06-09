export const SETTINGS_DEVICES_STORAGE_KEY = "smart-home-settings-devices-v1";
export const SETTINGS_DEVICES_SCHEMA_VERSION = 1;

export type SettingsDeviceConfig = {
  id: string;
  name: string;
  type: string;
  room: string;
  home: string;
  online: boolean;
  lastSeen: string;
  firmware: string;
  ip: string;
  mac: string;
};

export type SettingsDevicesState = {
  schemaVersion: typeof SETTINGS_DEVICES_SCHEMA_VERSION;
  updatedAt: string;
  devices: SettingsDeviceConfig[];
};

export function parseSettingsDevices(
  raw: string | null,
  fallbackDevices: SettingsDeviceConfig[]
): SettingsDeviceConfig[] {
  const fallback = normalizeSettingsDevices(fallbackDevices);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = normalizeSettingsDevicesState(JSON.parse(raw));
    return parsed?.devices.length ? parsed.devices : fallback;
  } catch {
    return fallback;
  }
}

export function serializeSettingsDevices(
  devices: SettingsDeviceConfig[],
  updatedAt: Date = new Date()
): string {
  const state: SettingsDevicesState = {
    schemaVersion: SETTINGS_DEVICES_SCHEMA_VERSION,
    updatedAt: updatedAt.toISOString(),
    devices: normalizeSettingsDevices(devices)
  };

  return JSON.stringify(state);
}

export function normalizeSettingsDevices(value: unknown): SettingsDeviceConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const devices: SettingsDeviceConfig[] = [];

  for (const item of value) {
    const device = normalizeSettingsDevice(item);

    if (!device || seen.has(device.id)) {
      continue;
    }

    seen.add(device.id);
    devices.push(device);
  }

  return devices;
}

export function createNextSettingsDeviceId(devices: SettingsDeviceConfig[]): string {
  const nextIndex = devices.reduce((maxIndex, device) => {
    const match = /^device-custom-(\d+)$/.exec(device.id);
    return match ? Math.max(maxIndex, Number(match[1])) : maxIndex;
  }, 0) + 1;

  return `device-custom-${nextIndex}`;
}

export function normalizeSettingsDevicesState(value: unknown): SettingsDevicesState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SETTINGS_DEVICES_SCHEMA_VERSION ||
    typeof value.updatedAt !== "string" ||
    Number.isNaN(new Date(value.updatedAt).getTime()) ||
    !Array.isArray(value.devices)
  ) {
    return null;
  }

  const devices = normalizeSettingsDevices(value.devices);

  if (devices.length === 0) {
    return null;
  }

  return {
    schemaVersion: SETTINGS_DEVICES_SCHEMA_VERSION,
    updatedAt: value.updatedAt,
    devices
  };
}

function normalizeSettingsDevice(value: unknown): SettingsDeviceConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readRequiredString(value.id);
  const name = readRequiredString(value.name);
  const type = readRequiredString(value.type);

  if (!id || !name || !type) {
    return null;
  }

  return {
    id,
    name,
    type,
    room: readOptionalString(value.room, "未分配"),
    home: readOptionalString(value.home, "未分配"),
    online: typeof value.online === "boolean" ? value.online : false,
    lastSeen: readDateString(value.lastSeen),
    firmware: readOptionalString(value.firmware, "未知"),
    ip: readOptionalString(value.ip, "待分配"),
    mac: readOptionalString(value.mac, "待配对")
  };
}

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readOptionalString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function readDateString(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    return "1970-01-01T00:00:00.000Z";
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

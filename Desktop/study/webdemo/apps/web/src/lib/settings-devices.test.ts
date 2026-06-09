import { describe, expect, it } from "vitest";
import {
  SETTINGS_DEVICES_SCHEMA_VERSION,
  createNextSettingsDeviceId,
  parseSettingsDevices,
  serializeSettingsDevices,
  type SettingsDeviceConfig
} from "./settings-devices";

const seedDevice: SettingsDeviceConfig = {
  id: "device-relay-01",
  name: "主灯继电器",
  type: "relay-controller",
  room: "客厅",
  home: "温馨公寓",
  online: true,
  lastSeen: "2026-05-28T10:30:00Z",
  firmware: "v1.2.3",
  ip: "192.168.1.101",
  mac: "AA:BB:CC:DD:EE:01"
};

describe("settings devices", () => {
  it("serializes and parses device maintenance state", () => {
    const serialized = serializeSettingsDevices(
      [{ ...seedDevice, name: "主灯继电器 Pro", room: "书房" }],
      new Date("2026-06-09T08:00:00.000Z")
    );
    const payload = JSON.parse(serialized);

    expect(payload).toEqual(
      expect.objectContaining({
        schemaVersion: SETTINGS_DEVICES_SCHEMA_VERSION,
        updatedAt: "2026-06-09T08:00:00.000Z"
      })
    );
    expect(parseSettingsDevices(serialized, [seedDevice])).toEqual([
      expect.objectContaining({
        id: "device-relay-01",
        name: "主灯继电器 Pro",
        room: "书房"
      })
    ]);
  });

  it("falls back to seed devices for malformed state", () => {
    expect(parseSettingsDevices("not json", [seedDevice])).toEqual([seedDevice]);
    expect(parseSettingsDevices(JSON.stringify({ schemaVersion: 999, devices: [] }), [seedDevice])).toEqual([
      seedDevice
    ]);
  });

  it("uses the highest custom device index for new local devices", () => {
    expect(
      createNextSettingsDeviceId([
        seedDevice,
        { ...seedDevice, id: "device-custom-1" },
        { ...seedDevice, id: "device-custom-4" }
      ])
    ).toBe("device-custom-5");
  });
});

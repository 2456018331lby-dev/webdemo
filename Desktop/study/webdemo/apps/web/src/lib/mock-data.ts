export type HomeSummary = {
  id: string;
  name: string;
  memberRole: "owner" | "member" | "installer";
  rooms: Array<{
    id: string;
    name: string;
    devices: Array<{
      id: string;
      name: string;
      type: string;
      online: boolean;
      relayOn: boolean;
      lastTelemetry: string;
    }>;
  }>;
};

export const homes: HomeSummary[] = [
  {
    id: "home-01",
    name: "Harbor Apartment",
    memberRole: "owner",
    rooms: [
      {
        id: "room-living",
        name: "Living Room",
        devices: [
          {
            id: "device-relay-01",
            name: "Main Light Relay",
            type: "relay-controller",
            online: true,
            relayOn: true,
            lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm"
          },
          {
            id: "device-sensor-01",
            name: "Climate Sensor",
            type: "environment-sensor",
            online: true,
            relayOn: false,
            lastTelemetry: "Humidity 48.1%, Voltage 3.28 V"
          }
        ]
      },
      {
        id: "room-kitchen",
        name: "Kitchen",
        devices: [
          {
            id: "device-relay-02",
            name: "Exhaust Relay",
            type: "relay-controller",
            online: false,
            relayOn: false,
            lastTelemetry: "Last heartbeat 2 minutes ago"
          }
        ]
      }
    ]
  }
];

export function findHome(homeId: string) {
  return homes.find((home) => home.id === homeId);
}

export function findDevice(deviceId: string) {
  for (const home of homes) {
    for (const room of home.rooms) {
      const device = room.devices.find((item) => item.id === deviceId);

      if (device) {
        return { home, room, device };
      }
    }
  }

  return null;
}

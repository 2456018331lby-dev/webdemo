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
    name: "温馨公寓",
    memberRole: "owner",
    rooms: [
      {
        id: "room-living",
        name: "客厅",
        devices: [
          {
            id: "device-relay-01",
            name: "主灯继电器",
            type: "relay-controller",
            online: true,
            relayOn: true,
            lastTelemetry: "温度 24.6°C, 信号强度 -61 dBm"
          },
          {
            id: "device-sensor-01",
            name: "温湿度传感器",
            type: "environment-sensor",
            online: true,
            relayOn: false,
            lastTelemetry: "湿度 48.1%, 电压 3.28 V"
          }
        ]
      },
      {
        id: "room-kitchen",
        name: "厨房",
        devices: [
          {
            id: "device-relay-02",
            name: "排风扇继电器",
            type: "relay-controller",
            online: false,
            relayOn: false,
            lastTelemetry: "最后心跳 2 分钟前"
          }
        ]
      },
      {
        id: "room-bedroom",
        name: "卧室",
        devices: [
          {
            id: "device-relay-03",
            name: "床头灯继电器",
            type: "relay-controller",
            online: true,
            relayOn: false,
            lastTelemetry: "温度 22.3°C, 信号强度 -55 dBm"
          },
          {
            id: "device-sensor-02",
            name: "空气质量传感器",
            type: "environment-sensor",
            online: true,
            relayOn: false,
            lastTelemetry: "CO2 450ppm, PM2.5 15μg/m³"
          }
        ]
      }
    ]
  },
  {
    id: "home-02",
    name: "办公室",
    memberRole: "member",
    rooms: [
      {
        id: "room-office",
        name: "办公区",
        devices: [
          {
            id: "device-relay-04",
            name: "照明继电器",
            type: "relay-controller",
            online: true,
            relayOn: true,
            lastTelemetry: "温度 25.1°C, 信号强度 -58 dBm"
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

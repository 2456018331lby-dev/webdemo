import type { HomeSummary } from "./mock-data";
import type { DeviceCommandRecord, DeviceStateRecord } from "./server/device-backend";

export type LandingRoom = {
  id: string;
  homeName: string;
  roomName: string;
  deviceCount: number;
  onlineCount: number;
  attentionCount: number;
  featuredDeviceId: string;
  featuredDeviceName: string;
  featuredTelemetry: string;
};

export type LandingPriorityAction = {
  id: "offline" | "timed-out" | "failed" | "steady";
  tone: "danger" | "warning" | "success";
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type LandingDashboardSummary = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  timedOutCommands: number;
  failedCommands: number;
  retryingCommands: number;
  onlineRate: number;
  attentionDevices: number;
  roomFocus: LandingRoom[];
  priorityActions: LandingPriorityAction[];
};

type LandingDashboardReaders = {
  getDeviceState(deviceId: string): DeviceStateRecord | Promise<DeviceStateRecord | null> | null;
  getCommandHistory(deviceId: string): DeviceCommandRecord[] | Promise<DeviceCommandRecord[]>;
};

type RoomDashboardResult = {
  roomFocus: LandingRoom | null;
  totalDevices: number;
  offlineDevices: number;
  timedOutCommands: number;
  failedCommands: number;
  retryingCommands: number;
};

type DeviceDashboardSnapshot = {
  id: string;
  name: string;
  online: boolean;
  latestStatus: DeviceCommandRecord["status"] | null;
  attemptCount: number;
  telemetry: string;
};

function buildPriorityActions(input: {
  offlineDevices: number;
  timedOutCommands: number;
  failedCommands: number;
}): LandingPriorityAction[] {
  const actions: LandingPriorityAction[] = [];

  if (input.offlineDevices > 0) {
    actions.push({
      id: "offline",
      tone: "danger",
      title: `${input.offlineDevices} 台设备离线`,
      description: "优先检查供电、Wi-Fi 或 ESP32S3 上报链路。",
      href: "/homes",
      cta: "打开总览"
    });
  }

  if (input.timedOutCommands > 0) {
    actions.push({
      id: "timed-out",
      tone: "warning",
      title: `${input.timedOutCommands} 条命令超时`,
      description: "确认 ESP32S3 到 STM32H743 的 ack 路径，再决定是否重试。",
      href: "/activity",
      cta: "查看日志"
    });
  }

  if (input.failedCommands > 0) {
    actions.push({
      id: "failed",
      tone: "danger",
      title: `${input.failedCommands} 条命令失败`,
      description: "先看失败原因和最近遥测，再回到设备页执行重试。",
      href: "/activity",
      cta: "查看日志"
    });
  }

  if (actions.length === 0) {
    return [
      {
        id: "steady",
        tone: "success",
        title: "当前没有高优先级风险",
        description: "可以直接进入设备页做日常控制。",
        href: "/devices",
        cta: "进入设备墙"
      }
    ];
  }

  return actions;
}

async function buildRoomDashboardResult(
  home: HomeSummary,
  room: HomeSummary["rooms"][number],
  readers: LandingDashboardReaders
): Promise<RoomDashboardResult> {
  const devices = await Promise.all(
    room.devices.map(async (device): Promise<DeviceDashboardSnapshot> => {
      const [state, history] = await Promise.all([
        readers.getDeviceState(device.id),
        readers.getCommandHistory(device.id)
      ]);
      const latest = history[0];

      return {
        id: device.id,
        name: device.name,
        online: state?.online ?? device.online,
        latestStatus: latest?.status ?? null,
        attemptCount: latest?.attemptCount ?? 1,
        telemetry: state?.lastTelemetry ?? device.lastTelemetry
      };
    })
  );

  let onlineCount = 0;
  let offlineDevices = 0;
  let timedOutCommands = 0;
  let failedCommands = 0;
  let retryingCommands = 0;
  let attentionCount = 0;

  for (const device of devices) {
    if (device.online) {
      onlineCount += 1;
    } else {
      offlineDevices += 1;
      attentionCount += 1;
    }

    if (device.latestStatus === "timed_out") {
      timedOutCommands += 1;
      attentionCount += 1;
    }

    if (device.latestStatus === "failed") {
      failedCommands += 1;
      attentionCount += 1;
    }

    if (device.latestStatus === "queued" && device.attemptCount > 1) {
      retryingCommands += 1;
    }
  }

  const featured = devices.find((device) => device.online) ?? devices[0];

  return {
    roomFocus: featured
      ? {
          id: room.id,
          homeName: home.name,
          roomName: room.name,
          deviceCount: devices.length,
          onlineCount,
          attentionCount,
          featuredDeviceId: featured.id,
          featuredDeviceName: featured.name,
          featuredTelemetry: featured.telemetry
        }
      : null,
    totalDevices: devices.length,
    offlineDevices,
    timedOutCommands,
    failedCommands,
    retryingCommands
  };
}

export async function buildLandingDashboardSummary(
  homes: HomeSummary[],
  readers: LandingDashboardReaders
): Promise<LandingDashboardSummary> {
  const roomResults = await Promise.all(
    homes.flatMap((home) => home.rooms.map((room) => buildRoomDashboardResult(home, room, readers)))
  );

  const totals = roomResults.reduce(
    (acc, room) => ({
      totalDevices: acc.totalDevices + room.totalDevices,
      offlineDevices: acc.offlineDevices + room.offlineDevices,
      timedOutCommands: acc.timedOutCommands + room.timedOutCommands,
      failedCommands: acc.failedCommands + room.failedCommands,
      retryingCommands: acc.retryingCommands + room.retryingCommands
    }),
    {
      totalDevices: 0,
      offlineDevices: 0,
      timedOutCommands: 0,
      failedCommands: 0,
      retryingCommands: 0
    }
  );

  const onlineDevices = totals.totalDevices - totals.offlineDevices;
  const onlineRate = totals.totalDevices > 0 ? Math.round((onlineDevices / totals.totalDevices) * 100) : 0;
  const attentionDevices = totals.offlineDevices + totals.timedOutCommands + totals.failedCommands;

  return {
    ...totals,
    onlineDevices,
    onlineRate,
    attentionDevices,
    roomFocus: roomResults.flatMap((room) => (room.roomFocus ? [room.roomFocus] : [])),
    priorityActions: buildPriorityActions(totals)
  };
}

import type { ActivityLog } from "./activity-logs";
import type { DeviceWithLocation } from "./device-list";

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";
export const JSON_MIME_TYPE = "application/json;charset=utf-8";

export type ExportPrimitive = string | number | boolean | null | undefined;

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => ExportPrimitive;
};

export type ActivityLogExportRow = {
  id: string;
  timestamp: string;
  type: ActivityLog["type"];
  typeLabel: string;
  level: ActivityLog["level"];
  levelLabel: string;
  title: string;
  message: string;
  deviceId: string;
  deviceName: string;
};

export type DeviceExportRow = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  online: boolean;
  relayOn: boolean;
  lastTelemetry: string;
  homeId: string;
  homeName: string;
  roomId: string;
  roomName: string;
  favorite: boolean;
};

const activityLogColumns: ExportColumn<ActivityLogExportRow>[] = [
  { header: "日志 ID", value: (row) => row.id },
  { header: "时间", value: (row) => row.timestamp },
  { header: "类型", value: (row) => row.typeLabel },
  { header: "级别", value: (row) => row.levelLabel },
  { header: "标题", value: (row) => row.title },
  { header: "消息", value: (row) => row.message },
  { header: "设备 ID", value: (row) => row.deviceId },
  { header: "设备名称", value: (row) => row.deviceName }
];

const deviceColumns: ExportColumn<DeviceExportRow>[] = [
  { header: "设备 ID", value: (row) => row.id },
  { header: "设备名称", value: (row) => row.name },
  { header: "类型", value: (row) => row.typeLabel },
  { header: "在线", value: (row) => formatBoolean(row.online) },
  { header: "继电器", value: (row) => (row.relayOn ? "开" : "关") },
  { header: "遥测", value: (row) => row.lastTelemetry },
  { header: "住宅", value: (row) => row.homeName },
  { header: "房间", value: (row) => row.roomName },
  { header: "收藏", value: (row) => formatBoolean(row.favorite) }
];

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function serializeJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function makeExportFilename(scope: string, extension: string, date: Date = new Date()): string {
  const safeScope = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";
  const safeExtension =
    extension
      .replace(/^\./, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "") || "txt";
  const datePart = date.toISOString().slice(0, 10);

  return `${safeScope}-${datePart}.${safeExtension}`;
}

export function buildActivityLogExportRows(logs: ActivityLog[]): ActivityLogExportRow[] {
  return logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    type: log.type,
    typeLabel: getActivityLogTypeLabel(log.type),
    level: log.level,
    levelLabel: getActivityLogLevelLabel(log.level),
    title: log.title,
    message: log.message,
    deviceId: log.deviceId ?? "",
    deviceName: log.deviceName ?? ""
  }));
}

export function serializeActivityLogsAsCsv(logs: ActivityLog[]): string {
  return toCsv(buildActivityLogExportRows(logs), activityLogColumns);
}

export function serializeActivityLogsAsJson(logs: ActivityLog[]): string {
  return serializeJson(buildActivityLogExportRows(logs));
}

export function buildDeviceExportRows(
  devices: DeviceWithLocation[],
  favoriteIds: ReadonlySet<string>
): DeviceExportRow[] {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    typeLabel: getDeviceTypeLabel(device.type),
    online: device.online,
    relayOn: device.relayOn,
    lastTelemetry: device.lastTelemetry,
    homeId: device.homeId,
    homeName: device.homeName,
    roomId: device.roomId,
    roomName: device.roomName,
    favorite: favoriteIds.has(device.id)
  }));
}

export function serializeDevicesAsCsv(
  devices: DeviceWithLocation[],
  favoriteIds: ReadonlySet<string>
): string {
  return toCsv(buildDeviceExportRows(devices, favoriteIds), deviceColumns);
}

export function serializeDevicesAsJson(
  devices: DeviceWithLocation[],
  favoriteIds: ReadonlySet<string>
): string {
  return serializeJson(buildDeviceExportRows(devices, favoriteIds));
}

export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getActivityLogTypeLabel(type: ActivityLog["type"]): string {
  switch (type) {
    case "command": return "命令";
    case "alert": return "告警";
    case "system": return "系统";
    case "device": return "设备";
    default: return type;
  }
}

export function getActivityLogLevelLabel(level: ActivityLog["level"]): string {
  switch (level) {
    case "success": return "成功";
    case "warning": return "警告";
    case "error": return "错误";
    default: return "信息";
  }
}

export function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case "relay-controller": return "继电器";
    case "environment-sensor": return "传感器";
    case "smart-plug": return "智能插座";
    case "camera": return "摄像头";
    case "door-lock": return "门锁";
    default: return type;
  }
}

function escapeCsvValue(value: ExportPrimitive): string {
  const text = value == null ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function formatBoolean(value: boolean): string {
  return value ? "是" : "否";
}

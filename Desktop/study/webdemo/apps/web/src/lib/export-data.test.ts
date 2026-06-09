import { describe, expect, it } from "vitest";
import { activityLogs } from "./activity-logs";
import { buildDeviceList } from "./device-list";
import {
  buildActivityLogExportRows,
  buildDeviceExportRows,
  makeExportFilename,
  serializeActivityLogsAsCsv,
  serializeActivityLogsAsJson,
  serializeDevicesAsCsv,
  serializeDevicesAsJson,
  toCsv
} from "./export-data";
import { homes } from "./mock-data";

describe("export data helpers", () => {
  it("escapes csv fields with commas, quotes, and newlines", () => {
    const csv = toCsv(
      [{ name: "主灯,继电器", note: "ack \"ok\"\nready" }],
      [
        { header: "名称", value: (row) => row.name },
        { header: "备注", value: (row) => row.note }
      ]
    );

    expect(csv).toBe("名称,备注\r\n\"主灯,继电器\",\"ack \"\"ok\"\"\nready\"");
  });

  it("builds safe date-stamped filenames", () => {
    expect(makeExportFilename("Activity Logs", ".CSV", new Date("2026-06-07T08:00:00.000Z"))).toBe(
      "activity-logs-2026-06-07.csv"
    );
    expect(makeExportFilename("   ", "?", new Date("2026-06-07T08:00:00.000Z"))).toBe(
      "export-2026-06-07.txt"
    );
  });

  it("maps activity logs to csv and json export rows", () => {
    const rows = buildActivityLogExportRows(activityLogs.slice(0, 1));

    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: "log-001",
        typeLabel: "命令",
        levelLabel: "成功",
        deviceName: "主灯继电器"
      })
    );
    expect(serializeActivityLogsAsCsv(activityLogs.slice(0, 1))).toContain(
      "日志 ID,时间,类型,级别,标题,消息,设备 ID,设备名称"
    );
    expect(JSON.parse(serializeActivityLogsAsJson(activityLogs.slice(0, 1)))[0]).toEqual(rows[0]);
  });

  it("maps devices with favorite state for export", () => {
    const devices = buildDeviceList(homes);
    const rows = buildDeviceExportRows(devices.slice(0, 2), new Set(["device-relay-01"]));

    expect(rows).toEqual([
      expect.objectContaining({
        id: "device-relay-01",
        typeLabel: "继电器",
        online: true,
        relayOn: true,
        favorite: true
      }),
      expect.objectContaining({
        id: "device-sensor-01",
        typeLabel: "传感器",
        favorite: false
      })
    ]);
    expect(serializeDevicesAsCsv(devices.slice(0, 1), new Set(["device-relay-01"]))).toContain(
      "device-relay-01,主灯继电器,继电器,是,开"
    );
    expect(JSON.parse(serializeDevicesAsJson(devices.slice(0, 1), new Set()))[0]).toEqual(
      expect.objectContaining({ favorite: false })
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  activityLogs,
  createActivityLogViewState,
  defaultActivityLogFilters,
  getFilteredActivityLogs,
  hasActiveActivityLogFilters,
  parseActivityLogView,
  serializeActivityLogView
} from "./activity-logs";

describe("activity log helpers", () => {
  it("filters activity logs by query, type, level, and device id", () => {
    expect(
      getFilteredActivityLogs(activityLogs, {
        ...defaultActivityLogFilters,
        query: "排风扇",
        type: "alert"
      }).map((log) => log.id)
    ).toEqual(["log-002"]);

    expect(
      getFilteredActivityLogs(activityLogs, {
        ...defaultActivityLogFilters,
        level: "error"
      }).map((log) => log.id)
    ).toEqual(["log-005"]);

    expect(
      getFilteredActivityLogs(activityLogs, {
        ...defaultActivityLogFilters,
        query: "device-relay-03"
      }).map((log) => log.id)
    ).toEqual(["log-006"]);
  });

  it("serializes and normalizes saved activity log views defensively", () => {
    const view = createActivityLogViewState(
      {
        query: "排风扇",
        type: "alert",
        level: "warning"
      },
      new Date("2026-06-08T08:00:00.000Z")
    );

    expect(parseActivityLogView(serializeActivityLogView(view))).toEqual(view);
    expect(parseActivityLogView("not-json")).toBeNull();
    expect(parseActivityLogView(JSON.stringify({ ...view, schemaVersion: 2 }))).toBeNull();
    expect(
      parseActivityLogView(
        JSON.stringify({
          schemaVersion: 1,
          filters: {
            query: 42,
            type: "unknown",
            level: "urgent"
          },
          savedAt: "2026-06-08T08:00:00.000Z"
        })
      )
    ).toEqual({
      schemaVersion: 1,
      filters: defaultActivityLogFilters,
      savedAt: "2026-06-08T08:00:00.000Z"
    });

    expect(hasActiveActivityLogFilters(defaultActivityLogFilters)).toBe(false);
    expect(hasActiveActivityLogFilters({ ...defaultActivityLogFilters, query: "排风扇" })).toBe(true);
  });
});

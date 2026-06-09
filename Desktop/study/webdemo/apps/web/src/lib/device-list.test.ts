import { describe, expect, it } from "vitest";
import {
  buildDeviceList,
  createDeviceFilterViewState,
  defaultDeviceFilterCriteria,
  filterAndSortDevices,
  hasActiveDeviceFilters,
  parseFavoriteIds,
  parseDeviceFilterView,
  serializeDeviceFilterView,
  serializeFavoriteIds,
  toggleFavoriteId
} from "./device-list";
import { homes } from "./mock-data";

describe("device list helpers", () => {
  it("parses favorite ids defensively", () => {
    expect(parseFavoriteIds(null)).toEqual([]);
    expect(parseFavoriteIds("not-json")).toEqual([]);
    expect(parseFavoriteIds(JSON.stringify(["device-relay-01", 12, null]))).toEqual([
      "device-relay-01"
    ]);
  });

  it("serializes favorite ids in a stable order", () => {
    expect(serializeFavoriteIds(["device-relay-03", "device-relay-01", "device-relay-03"])).toBe(
      JSON.stringify(["device-relay-01", "device-relay-03"])
    );
  });

  it("toggles favorite ids", () => {
    expect(toggleFavoriteId(["device-relay-01"], "device-relay-03")).toEqual([
      "device-relay-01",
      "device-relay-03"
    ]);
    expect(toggleFavoriteId(["device-relay-01"], "device-relay-01")).toEqual([]);
  });

  it("serializes and normalizes saved device filter views defensively", () => {
    const view = createDeviceFilterViewState(
      {
        searchQuery: "主灯",
        filterType: "relay-controller",
        filterStatus: "online",
        favoriteOnly: true
      },
      new Date("2026-06-08T09:00:00.000Z")
    );

    expect(parseDeviceFilterView(serializeDeviceFilterView(view))).toEqual(view);
    expect(parseDeviceFilterView("not-json")).toBeNull();
    expect(parseDeviceFilterView(JSON.stringify({ ...view, schemaVersion: 2 }))).toBeNull();
    expect(
      parseDeviceFilterView(
        JSON.stringify({
          schemaVersion: 1,
          filters: {
            searchQuery: 42,
            filterType: "",
            filterStatus: "unknown",
            favoriteOnly: "yes"
          },
          savedAt: "2026-06-08T09:00:00.000Z"
        })
      )
    ).toEqual({
      schemaVersion: 1,
      filters: defaultDeviceFilterCriteria,
      savedAt: "2026-06-08T09:00:00.000Z"
    });

    expect(hasActiveDeviceFilters(defaultDeviceFilterCriteria)).toBe(false);
    expect(hasActiveDeviceFilters({ ...defaultDeviceFilterCriteria, favoriteOnly: true })).toBe(true);
  });

  it("filters favorite devices and keeps favorites first", () => {
    const devices = buildDeviceList(homes);
    const favoriteIds = new Set(["device-relay-03"]);

    const allResults = filterAndSortDevices(devices, {
      searchQuery: "",
      filterType: "all",
      filterStatus: "all",
      favoriteOnly: false,
      favoriteIds
    });
    expect(allResults[0].id).toBe("device-relay-03");

    const favoriteResults = filterAndSortDevices(devices, {
      searchQuery: "",
      filterType: "all",
      filterStatus: "all",
      favoriteOnly: true,
      favoriteIds
    });
    expect(favoriteResults.map((device) => device.id)).toEqual(["device-relay-03"]);
  });

  it("combines search, type, and status filters", () => {
    const devices = buildDeviceList(homes);

    const results = filterAndSortDevices(devices, {
      searchQuery: "卧室",
      filterType: "environment-sensor",
      filterStatus: "online",
      favoriteOnly: false,
      favoriteIds: new Set()
    });

    expect(results.map((device) => device.id)).toEqual(["device-sensor-02"]);
  });
});

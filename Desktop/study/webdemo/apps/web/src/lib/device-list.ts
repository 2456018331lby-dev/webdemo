import type { HomeSummary } from "./mock-data";

export const DEVICE_FAVORITES_STORAGE_KEY = "smart-home-device-favorites-v1";
export const DEVICE_FILTER_VIEW_STORAGE_KEY = "smart-home-device-filter-view-v1";

export type DeviceWithLocation = HomeSummary["rooms"][number]["devices"][number] & {
  homeName: string;
  homeId: string;
  roomName: string;
  roomId: string;
};

export type DeviceFilterState = {
  searchQuery: string;
  filterType: string;
  filterStatus: string;
  favoriteOnly: boolean;
  favoriteIds: Set<string>;
};

export type DeviceFilterCriteria = Omit<DeviceFilterState, "favoriteIds">;

export type DeviceFilterViewState = {
  schemaVersion: 1;
  filters: DeviceFilterCriteria;
  savedAt: string;
};

export const defaultDeviceFilterCriteria: DeviceFilterCriteria = {
  searchQuery: "",
  filterType: "all",
  filterStatus: "all",
  favoriteOnly: false
};

export function buildDeviceList(homes: HomeSummary[]): DeviceWithLocation[] {
  return homes.flatMap((home) =>
    home.rooms.flatMap((room) =>
      room.devices.map((device) => ({
        ...device,
        homeName: home.name,
        homeId: home.id,
        roomName: room.name,
        roomId: room.id
      }))
    )
  );
}

export function parseFavoriteIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function serializeFavoriteIds(ids: Iterable<string>): string {
  return JSON.stringify(Array.from(new Set(ids)).sort());
}

export function toggleFavoriteId(ids: Iterable<string>, deviceId: string): string[] {
  const next = new Set(ids);

  if (next.has(deviceId)) {
    next.delete(deviceId);
  } else {
    next.add(deviceId);
  }

  return Array.from(next).sort();
}

export function createDeviceFilterViewState(
  filters: DeviceFilterCriteria,
  savedAt: Date = new Date()
): DeviceFilterViewState {
  return {
    schemaVersion: 1,
    filters: normalizeDeviceFilterCriteria(filters),
    savedAt: savedAt.toISOString()
  };
}

export function parseDeviceFilterView(raw: string | null): DeviceFilterViewState | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeDeviceFilterViewState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeDeviceFilterView(view: DeviceFilterViewState): string {
  return JSON.stringify(normalizeDeviceFilterViewState(view));
}

export function hasActiveDeviceFilters(filters: DeviceFilterCriteria): boolean {
  const normalizedFilters = normalizeDeviceFilterCriteria(filters);

  return (
    normalizedFilters.searchQuery.trim() !== "" ||
    normalizedFilters.filterType !== defaultDeviceFilterCriteria.filterType ||
    normalizedFilters.filterStatus !== defaultDeviceFilterCriteria.filterStatus ||
    normalizedFilters.favoriteOnly !== defaultDeviceFilterCriteria.favoriteOnly
  );
}

export function normalizeDeviceFilterCriteria(value: unknown): DeviceFilterCriteria {
  if (!isRecord(value)) {
    return defaultDeviceFilterCriteria;
  }

  return {
    searchQuery:
      typeof value.searchQuery === "string" ? value.searchQuery : defaultDeviceFilterCriteria.searchQuery,
    filterType:
      typeof value.filterType === "string" && value.filterType.trim() !== ""
        ? value.filterType
        : defaultDeviceFilterCriteria.filterType,
    filterStatus: normalizeDeviceStatusFilter(value.filterStatus),
    favoriteOnly: typeof value.favoriteOnly === "boolean" ? value.favoriteOnly : defaultDeviceFilterCriteria.favoriteOnly
  };
}

export function filterAndSortDevices(
  devices: DeviceWithLocation[],
  filters: DeviceFilterState
): DeviceWithLocation[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return devices
    .filter((device) => {
      const matchesSearch =
        query === "" ||
        device.name.toLowerCase().includes(query) ||
        device.roomName.toLowerCase().includes(query) ||
        device.homeName.toLowerCase().includes(query);

      const matchesType = filters.filterType === "all" || device.type === filters.filterType;
      const matchesStatus =
        filters.filterStatus === "all" ||
        (filters.filterStatus === "online" && device.online) ||
        (filters.filterStatus === "offline" && !device.online);
      const matchesFavorite = !filters.favoriteOnly || filters.favoriteIds.has(device.id);

      return matchesSearch && matchesType && matchesStatus && matchesFavorite;
    })
    .sort((a, b) => {
      const aFavorite = filters.favoriteIds.has(a.id);
      const bFavorite = filters.favoriteIds.has(b.id);

      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }

      return `${a.homeName}-${a.roomName}-${a.name}`.localeCompare(
        `${b.homeName}-${b.roomName}-${b.name}`,
        "zh-CN"
      );
    });
}

function normalizeDeviceFilterViewState(value: unknown): DeviceFilterViewState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.savedAt !== "string" ||
    Number.isNaN(new Date(value.savedAt).getTime())
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    filters: normalizeDeviceFilterCriteria(value.filters),
    savedAt: value.savedAt
  };
}

function normalizeDeviceStatusFilter(value: unknown): DeviceFilterCriteria["filterStatus"] {
  if (value === "all" || value === "online" || value === "offline") {
    return value;
  }

  return defaultDeviceFilterCriteria.filterStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import type { Database } from "@/lib/supabase/types";
import type { DeviceCommandRecord, DeviceStateRecord } from "./device-backend";

type DeviceSnapshot = {
  state: DeviceStateRecord | null;
  commandHistory: DeviceCommandRecord[];
};

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
        order?: (
          column: string,
          options?: { ascending?: boolean }
        ) => {
          limit?: (count: number) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
};

function isDeviceStateRow(value: unknown): value is Database["public"]["Tables"]["device_state"]["Row"] {
  return typeof value === "object" && value !== null && "device_id" in value;
}

function isDeviceCommandRows(
  value: unknown
): value is Array<Database["public"]["Tables"]["device_commands"]["Row"]> {
  return Array.isArray(value);
}

export async function fetchDeviceSnapshotFromSupabase(
  client: SupabaseLikeClient,
  deviceId: string
): Promise<DeviceSnapshot | null> {
  const stateResponse = await client
    .from("device_state")
    .select("device_id, desired_state, reported_state, last_reported_at, updated_at")
    .eq("device_id", deviceId)
    .maybeSingle?.();

  const commandResponse = await client
    .from("device_commands")
    .select(
      "id, device_id, correlation_id, command_type, status, payload, requested_at"
    )
    .eq("device_id", deviceId)
    .order?.("requested_at", { ascending: false })
    .limit?.(20);

  if (!stateResponse || !commandResponse) {
    return null;
  }

  if (stateResponse.error || commandResponse.error) {
    throw new Error("Supabase device snapshot query failed");
  }

  if (!isDeviceStateRow(stateResponse.data)) {
    return null;
  }

  const stateRow = stateResponse.data;
  const commandRows = isDeviceCommandRows(commandResponse.data)
    ? commandResponse.data
    : [];

  const relayState =
    typeof stateRow.reported_state === "object" &&
    stateRow.reported_state !== null &&
    "relay" in stateRow.reported_state
      ? (stateRow.reported_state as { relay?: { value?: boolean } }).relay
      : undefined;

  const state: DeviceStateRecord = {
    deviceId: stateRow.device_id,
    relayOn: Boolean(relayState?.value),
    lastTelemetry: stateRow.last_reported_at
      ? `Last reported at ${stateRow.last_reported_at}`
      : "No telemetry yet",
    online: Boolean(stateRow.last_reported_at),
    updatedAt: stateRow.updated_at
  };

  const commandHistory: DeviceCommandRecord[] = commandRows.map((row) => ({
    commandId: row.id,
    deviceId: row.device_id,
    correlationId: row.correlation_id,
    commandType: row.command_type as DeviceCommandRecord["commandType"],
    payload:
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {},
    requestedAt: row.requested_at,
    status: row.status
  }));

  return {
    state,
    commandHistory
  };
}

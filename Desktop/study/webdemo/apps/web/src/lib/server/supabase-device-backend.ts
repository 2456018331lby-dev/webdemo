import { randomUUID } from "node:crypto";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import {
  classifyAckResult,
  computeRetryDelayMs,
  computeTimeoutTransition,
  shouldRetryCommand
} from "@/lib/control-lifecycle";
import type {
  DeviceBackend,
  DeviceCommandRecord,
  DeviceStateRecord
} from "./device-backend";
import { fetchDeviceSnapshotFromSupabase } from "./supabase-device-snapshot-reader";

type DeviceSnapshot = {
  state: DeviceStateRecord | null;
  commandHistory: DeviceCommandRecord[];
};

type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type DeviceStateRow = Database["public"]["Tables"]["device_state"]["Row"];

type CommandStatusUpdate = {
  status: CommandRow["status"];
  delivered_at?: string | null;
  acknowledged_at?: string | null;
  failure_reason?: string | null;
  attempt_count?: number;
  next_retry_at?: string | null;
};

type DeviceCommandInsert = {
  id: string;
  device_id: string;
  correlation_id: string;
  command_type: string;
  status: CommandRow["status"];
  payload: Json;
  requested_by: string | null;
  requested_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  failure_reason: string | null;
  attempt_count: number;
  next_retry_at: string | null;
};

type DeviceStateUpdate = {
  desired_state?: Json;
  reported_state?: Json;
  last_reported_at?: string | null;
  updated_at: string;
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
        update?: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert?: (values: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    upsert?: (values: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    update?: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

type SupabaseDeviceBackendOptions = {
  client?: SupabaseLikeClient;
  fetchDeviceSnapshot?: (deviceId: string) => Promise<DeviceSnapshot | null>;
};

function nowIso() {
  return new Date().toISOString();
}

function ensureJsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeReportedStateFromDeviceState(row: DeviceStateRow | null | undefined) {
  return ensureJsonObject(row?.reported_state);
}

function buildDesiredStatePatch(input: CommandRequest) {
  if (input.commandType === "relay.set") {
    return {
      relay: {
        channel: typeof input.payload.channel === "number" ? input.payload.channel : 1,
        value: Boolean(input.payload.value)
      }
    };
  }

  return {
    commandType: input.commandType,
    ...ensureJsonObject(input.payload)
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future Supabase RLS-based reads
function mapStateRowToRecord(row: DeviceStateRow): DeviceStateRecord {
  const relayState =
    typeof row.reported_state === "object" &&
    row.reported_state !== null &&
    "relay" in row.reported_state
      ? (row.reported_state as { relay?: { value?: boolean } }).relay
      : undefined;

  return {
    deviceId: row.device_id,
    relayOn: Boolean(relayState?.value),
    lastTelemetry: row.last_reported_at ? `Last reported at ${row.last_reported_at}` : "No telemetry yet",
    online: Boolean(row.last_reported_at),
    updatedAt: row.updated_at
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future Supabase RLS-based reads
function mapCommandRowToRecord(row: CommandRow): DeviceCommandRecord {
  return {
    commandId: row.id,
    deviceId: row.device_id,
    correlationId: row.correlation_id,
    commandType: row.command_type as DeviceCommandRecord["commandType"],
    payload:
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {},
    requestedAt: row.requested_at,
    status: row.status,
    attemptCount: row.attempt_count ?? 1,
    nextRetryAt: row.next_retry_at ?? null
  };
}

const MAX_ATTEMPTS = 3;
const COMMAND_TIMEOUT_MS = 5000;

export class SupabaseDeviceBackend implements DeviceBackend {
  private readonly client: SupabaseLikeClient;
  private readonly fetchDeviceSnapshotImpl: (deviceId: string) => Promise<DeviceSnapshot | null>;
  private readonly snapshotCache = new Map<string, DeviceSnapshot | null>();

  constructor(options: SupabaseDeviceBackendOptions = {}) {
    this.client =
      options.client ??
      ({
        from: (table: string) => {
          throw new Error(`Supabase client unavailable for table ${table}`);
        }
      } as SupabaseLikeClient);

    this.fetchDeviceSnapshotImpl =
      options.fetchDeviceSnapshot ??
      (async (deviceId) => {
        const client =
          options.client ??
          ((await createSupabaseServerClient()) as unknown as Parameters<
            typeof fetchDeviceSnapshotFromSupabase
          >[0]);
        return fetchDeviceSnapshotFromSupabase(client, deviceId);
      });
  }

  reset() {
    this.snapshotCache.clear();
  }

  seedState(input: DeviceStateRecord) {
    this.snapshotCache.set(input.deviceId, {
      state: input,
      commandHistory: this.snapshotCache.get(input.deviceId)?.commandHistory ?? []
    });
  }

  async getState(deviceId: string) {
    const snapshot = await this.getSnapshot(deviceId, { forceRefresh: true });
    return snapshot?.state ?? null;
  }

  async getCommandHistory(deviceId: string) {
    const snapshot = await this.getSnapshot(deviceId, { forceRefresh: true });
    return snapshot?.commandHistory ?? [];
  }

  queueCommand(input: CommandRequest) {
    const commandId = randomUUID();
    const requestedAt = nowIso();

    void this.persistQueuedCommand({
      id: commandId,
      device_id: input.deviceId,
      correlation_id: input.correlationId,
      command_type: input.commandType,
      status: "queued",
      payload: input.payload as Json,
      requested_by: null,
      requested_at: requestedAt,
      delivered_at: null,
      acknowledged_at: null,
      failure_reason: null,
      attempt_count: 1,
      next_retry_at: null
    });

    const cachedSnapshot = this.snapshotCache.get(input.deviceId);
    const commandRecord: DeviceCommandRecord = {
      commandId,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      commandType: input.commandType,
      payload: input.payload,
      requestedAt,
      status: "queued",
      attemptCount: 1,
      nextRetryAt: null
    };

    this.snapshotCache.set(input.deviceId, {
      state: cachedSnapshot?.state ?? null,
      commandHistory: [commandRecord, ...(cachedSnapshot?.commandHistory ?? [])]
    });

    return commandRecord;
  }

  markCommandDelivered(deviceId: string, commandId: string) {
    const deliveredAt = nowIso();
    void this.persistCommandStatus(deviceId, commandId, {
      status: "delivered",
      delivered_at: deliveredAt,
      next_retry_at: null
    });

    const snapshot = this.snapshotCache.get(deviceId);
    if (snapshot) {
      this.snapshotCache.set(deviceId, {
        state: snapshot.state,
        commandHistory: snapshot.commandHistory.map((command) =>
          command.commandId === commandId
            ? { ...command, status: "delivered", nextRetryAt: null }
            : command
        )
      });
    }
  }

  applyAckPayload(deviceId: string, commandId: string, ack: AckPayload) {
    void this.persistAckOutcome(deviceId, commandId, ack);

    const snapshot = this.snapshotCache.get(deviceId);
    const currentCommand = snapshot?.commandHistory.find((entry) => entry.commandId === commandId);
    const currentState = snapshot?.state ?? null;
    const classification = classifyAckResult(ack.result);

    let nextCommandPatch: Partial<DeviceCommandRecord> = {
      status: classification === "acknowledged" ? "acknowledged" : "failed",
      nextRetryAt: null
    };

    if (
      currentCommand &&
      classification === "retryable" &&
      shouldRetryCommand({
        ackResult: ack.result,
        attemptsUsed: currentCommand.attemptCount ?? 1,
        maxAttempts: MAX_ATTEMPTS,
        deviceOnline: currentState?.online ?? false
      })
    ) {
      const nextAttemptCount = (currentCommand.attemptCount ?? 1) + 1;
      const nextRetryAt = new Date(
        new Date(ack.reportedAt).getTime() + computeRetryDelayMs(nextAttemptCount)
      ).toISOString();

      nextCommandPatch = {
        status: "queued",
        attemptCount: nextAttemptCount,
        nextRetryAt
      };
    }

    const relayState = ack.reportedState.relay as { value?: boolean } | undefined;
    const nextState =
      currentState && typeof relayState?.value === "boolean"
        ? {
            ...currentState,
            relayOn: relayState.value,
            updatedAt: ack.reportedAt,
            lastTelemetry: `Last reported at ${ack.reportedAt}`,
            online: true
          }
        : currentState;

    if (snapshot) {
      this.snapshotCache.set(deviceId, {
        state: nextState,
        commandHistory: snapshot.commandHistory.map((command) =>
          command.commandId === commandId ? { ...command, ...nextCommandPatch } : command
        )
      });
    }
  }

  async applyLifecyclePolicies(input: { now: string }) {
    const cachedEntries = [...this.snapshotCache.entries()];

    await Promise.all(
      cachedEntries.map(async ([deviceId, snapshot]) => {
        const commands = snapshot?.commandHistory ?? [];

        await Promise.all(
          commands.map(async (command) => {
            const nextStatus = computeTimeoutTransition({
              status: command.status,
              requestedAt: command.requestedAt,
              now: input.now,
              timeoutMs: COMMAND_TIMEOUT_MS
            });

            if (nextStatus !== command.status) {
              await this.persistCommandStatus(deviceId, command.commandId, {
                status: nextStatus,
                failure_reason: nextStatus === "timed_out" ? "Command acknowledgement timed out" : null
              });
            }
          })
        );

        await this.getSnapshot(deviceId, { forceRefresh: true });
      })
    );
  }

  async simulateCommandDelivery(deviceId: string, commandId: string) {
    this.markCommandDelivered(deviceId, commandId);

    const commandHistory = await this.getCommandHistory(deviceId);
    const command = commandHistory.find((entry) => entry.commandId === commandId);

    if (!command) {
      throw new Error("Command not found");
    }

    const nextRelayValue =
      typeof command.payload.value === "boolean"
        ? command.payload.value
        : (await this.getState(deviceId))?.relayOn ?? false;

    const ack: AckPayload = {
      messageType: "ack",
      correlationId: command.correlationId,
      result: command.correlationId.includes("busy") ? "busy" : "ok",
      reportedState: {
        relay: {
          channel: typeof command.payload.channel === "number" ? command.payload.channel : 1,
          value: nextRelayValue
        }
      },
      reportedAt: nowIso()
    };

    this.applyAckPayload(deviceId, commandId, ack);
    await this.getSnapshot(deviceId, { forceRefresh: true });
    return ack;
  }

  private async persistQueuedCommand(row: DeviceCommandInsert) {
    await this.runMutation(
      this.client.from("device_commands").insert?.(row),
      "Supabase command insert failed"
    );

    const stateResponse = await this.client
      .from("device_state")
      .select("device_id, desired_state, reported_state, last_reported_at, updated_at")
      .eq("device_id", row.device_id)
      .maybeSingle?.();

    const existingState = stateResponse?.data as DeviceStateRow | null | undefined;
    const nextDesiredState = {
      ...ensureJsonObject(existingState?.desired_state),
      ...buildDesiredStatePatch({
        deviceId: row.device_id,
        commandType: row.command_type as CommandRequest["commandType"],
        correlationId: row.correlation_id,
        payload: ensureJsonObject(row.payload)
      })
    };

    await this.upsertDeviceState(row.device_id, {
      desired_state: nextDesiredState as Json,
      reported_state: normalizeReportedStateFromDeviceState(existingState) as Json,
      last_reported_at: existingState?.last_reported_at ?? null,
      updated_at: row.requested_at
    });
  }

  private async persistCommandStatus(
    deviceId: string,
    commandId: string,
    update: CommandStatusUpdate
  ) {
    await this.runMutation(
      this.client.from("device_commands").update?.(update)?.eq("id", commandId),
      "Supabase command update failed"
    );

    const cachedSnapshot = this.snapshotCache.get(deviceId);
    if (cachedSnapshot) {
      this.snapshotCache.set(deviceId, {
        state: cachedSnapshot.state,
        commandHistory: cachedSnapshot.commandHistory.map((command) =>
          command.commandId === commandId
            ? {
                ...command,
                status: update.status,
                attemptCount: update.attempt_count ?? command.attemptCount,
                nextRetryAt:
                  update.next_retry_at === undefined ? command.nextRetryAt : update.next_retry_at
              }
            : command
        )
      });
    }
  }

  private async persistAckOutcome(deviceId: string, commandId: string, ack: AckPayload) {
    const stateResponse = await this.client
      .from("device_state")
      .select("device_id, desired_state, reported_state, last_reported_at, updated_at")
      .eq("device_id", deviceId)
      .maybeSingle?.();

    const existingState = stateResponse?.data as DeviceStateRow | null | undefined;
    const cachedSnapshot = this.snapshotCache.get(deviceId);
    const currentCommand = cachedSnapshot?.commandHistory.find((entry) => entry.commandId === commandId);
    const currentAttemptCount = currentCommand?.attemptCount ?? 1;
    const classification = classifyAckResult(ack.result);
    const shouldRetry =
      classification === "retryable" &&
      shouldRetryCommand({
        ackResult: ack.result,
        attemptsUsed: currentAttemptCount,
        maxAttempts: MAX_ATTEMPTS,
        deviceOnline: cachedSnapshot?.state?.online ?? Boolean(existingState?.last_reported_at)
      });

    const nextAttemptCount = shouldRetry ? currentAttemptCount + 1 : currentAttemptCount;
    const nextRetryAt = shouldRetry
      ? new Date(new Date(ack.reportedAt).getTime() + computeRetryDelayMs(nextAttemptCount)).toISOString()
      : null;

    await this.persistCommandStatus(deviceId, commandId, {
      status: shouldRetry
        ? "queued"
        : classification === "acknowledged"
          ? "acknowledged"
          : "failed",
      acknowledged_at: classification === "acknowledged" ? ack.reportedAt : null,
      failure_reason:
        classification === "failed"
          ? ack.result
          : shouldRetry
            ? `Retry scheduled after ${ack.result}`
            : null,
      attempt_count: nextAttemptCount,
      next_retry_at: nextRetryAt
    });

    await this.upsertDeviceState(deviceId, {
      desired_state: existingState?.desired_state ?? ({} as Json),
      reported_state: ack.reportedState as Json,
      last_reported_at: ack.reportedAt,
      updated_at: ack.reportedAt
    });
  }

  private async upsertDeviceState(deviceId: string, update: DeviceStateUpdate) {
    await this.runMutation(
      this.client
        .from("device_state")
        .upsert?.({
          device_id: deviceId,
          desired_state: update.desired_state ?? ({} as Json),
          reported_state: update.reported_state ?? ({} as Json),
          last_reported_at: update.last_reported_at ?? null,
          updated_at: update.updated_at
        }),
      "Supabase device_state upsert failed"
    );
  }

  private async getSnapshot(deviceId: string, options?: { forceRefresh?: boolean }) {
    if (!options?.forceRefresh && this.snapshotCache.has(deviceId)) {
      return this.snapshotCache.get(deviceId) ?? null;
    }

    const snapshot = await this.fetchDeviceSnapshotImpl(deviceId);
    this.snapshotCache.set(deviceId, snapshot ?? null);
    return snapshot ?? null;
  }

  private async runMutation<T extends { error: unknown } | undefined>(
    operation: Promise<T> | undefined,
    errorMessage: string
  ) {
    const response = await operation;

    if (!response) {
      throw new Error(errorMessage);
    }

    if (response.error) {
      throw new Error(errorMessage);
    }
  }
}

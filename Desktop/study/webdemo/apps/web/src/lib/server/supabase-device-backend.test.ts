import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckPayload, CommandRequest } from "@smart-home/device-contract";
import { SupabaseDeviceBackend } from "./supabase-device-backend";

type MockDbState = {
  device_state: Map<string, {
    device_id: string;
    desired_state: Record<string, unknown>;
    reported_state: Record<string, unknown>;
    last_reported_at: string | null;
    updated_at: string;
  }>;
  device_commands: Map<string, {
    id: string;
    device_id: string;
    correlation_id: string;
    command_type: string;
    status: "queued" | "delivered" | "acknowledged" | "failed" | "timed_out";
    payload: Record<string, unknown>;
    requested_by: string | null;
    requested_at: string;
    delivered_at: string | null;
    acknowledged_at: string | null;
    failure_reason: string | null;
    attempt_count: number;
    next_retry_at: string | null;
  }>;
};

function createMockSupabaseClient(state: MockDbState) {
  return {
    from(table: string) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        select(_columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                async maybeSingle() {
                  if (table === "device_state" && column === "device_id") {
                    return { data: state.device_state.get(value) ?? null, error: null };
                  }

                  return { data: null, error: null };
                },
                order(orderColumn: string, options?: { ascending?: boolean }) {
                  return {
                    async limit(count: number) {
                      if (table !== "device_commands" || column !== "device_id") {
                        return { data: [], error: null };
                      }

                      const rows = [...state.device_commands.values()]
                        .filter((row) => row.device_id === value)
                        .sort((a, b) => {
                          const delta =
                            new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
                          return options?.ascending === false ? -delta : delta;
                        })
                        .slice(0, count);

                      return { data: rows, error: null };
                    }
                  };
                },
                update(values: Record<string, unknown>) {
                  return {
                    async eq(updateColumn: string, updateValue: string) {
                      if (table !== "device_commands" || updateColumn !== "id") {
                        return { data: null, error: null };
                      }

                      const existing = state.device_commands.get(updateValue);
                      if (!existing) {
                        return { data: null, error: new Error("missing command") };
                      }

                      state.device_commands.set(updateValue, {
                        ...existing,
                        ...values
                      } as MockDbState["device_commands"] extends Map<string, infer T> ? T : never);

                      return { data: null, error: null };
                    }
                  };
                }
              };
            }
          };
        },
        async insert(values: Record<string, unknown>) {
          if (table === "device_commands") {
            const row = values as MockDbState["device_commands"] extends Map<string, infer T> ? T : never;
            state.device_commands.set(row.id, row);
          }

          return { data: null, error: null };
        },
        async upsert(values: Record<string, unknown>) {
          if (table === "device_state") {
            const row = values as MockDbState["device_state"] extends Map<string, infer T> ? T : never;
            state.device_state.set(row.device_id, row);
          }

          return { data: null, error: null };
        },
        update(values: Record<string, unknown>) {
          return {
            async eq(updateColumn: string, updateValue: string) {
              if (table !== "device_commands" || updateColumn !== "id") {
                return { data: null, error: null };
              }

              const existing = state.device_commands.get(updateValue);
              if (!existing) {
                return { data: null, error: new Error("missing command") };
              }

              state.device_commands.set(updateValue, {
                ...existing,
                ...values
              } as MockDbState["device_commands"] extends Map<string, infer T> ? T : never);

              return { data: null, error: null };
            }
          };
        }
      };
    }
  };
}

describe("SupabaseDeviceBackend", () => {
  let mockState: MockDbState;

  beforeEach(() => {
    mockState = {
      device_state: new Map([
        [
          "device-relay-01",
          {
            device_id: "device-relay-01",
            desired_state: { relay: { channel: 1, value: false } },
            reported_state: { relay: { channel: 1, value: true } },
            last_reported_at: "2026-05-10T09:00:03Z",
            updated_at: "2026-05-10T09:00:03Z"
          }
        ]
      ]),
      device_commands: new Map([
        [
          "cmd-002",
          {
            id: "cmd-002",
            device_id: "device-relay-01",
            correlation_id: "corr-002",
            command_type: "relay.set",
            status: "acknowledged",
            payload: { channel: 1, value: true },
            requested_by: null,
            requested_at: "2026-05-10T09:00:02Z",
            delivered_at: "2026-05-10T09:00:02Z",
            acknowledged_at: "2026-05-10T09:00:03Z",
            failure_reason: null,
            attempt_count: 1,
            next_retry_at: null
          }
        ],
        [
          "cmd-001",
          {
            id: "cmd-001",
            device_id: "device-relay-01",
            correlation_id: "corr-001",
            command_type: "relay.set",
            status: "queued",
            payload: { channel: 1, value: false },
            requested_by: null,
            requested_at: "2026-05-10T09:00:01Z",
            delivered_at: null,
            acknowledged_at: null,
            failure_reason: null,
            attempt_count: 1,
            next_retry_at: null
          }
        ]
      ])
    };
  });

  it("returns state for a known device from the injected snapshot reader", async () => {
    const backend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot: async (deviceId) => {
        if (deviceId !== "device-relay-01") {
          return null;
        }

        return {
          state: {
            deviceId: "device-relay-01",
            relayOn: true,
            lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
            online: true,
            updatedAt: "2026-05-10T09:00:03Z"
          },
          commandHistory: [
            {
              commandId: "cmd-002",
              deviceId: "device-relay-01",
              correlationId: "corr-002",
              commandType: "relay.set",
              payload: { channel: 1, value: true },
              requestedAt: "2026-05-10T09:00:02Z",
              status: "acknowledged",
              attemptCount: 1,
              nextRetryAt: null
            },
            {
              commandId: "cmd-001",
              deviceId: "device-relay-01",
              correlationId: "corr-001",
              commandType: "relay.set",
              payload: { channel: 1, value: false },
              requestedAt: "2026-05-10T09:00:01Z",
              status: "queued",
              attemptCount: 1,
              nextRetryAt: null
            }
          ]
        };
      }
    });

    const state = await backend.getState("device-relay-01");

    expect(state?.deviceId).toBe("device-relay-01");
    expect(state?.relayOn).toBe(true);
    expect(state?.online).toBe(true);
  });

  it("returns command history for a known device from the injected snapshot reader", async () => {
    const backend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot: async () => ({
        state: {
          deviceId: "device-relay-01",
          relayOn: true,
          lastTelemetry: "Temperature 24.6 C, RSSI -61 dBm",
          online: true,
          updatedAt: "2026-05-10T09:00:03Z"
        },
        commandHistory: [
          {
            commandId: "cmd-002",
            deviceId: "device-relay-01",
            correlationId: "corr-002",
            commandType: "relay.set",
            payload: { channel: 1, value: true },
            requestedAt: "2026-05-10T09:00:02Z",
            status: "acknowledged",
            attemptCount: 1,
            nextRetryAt: null
          },
          {
            commandId: "cmd-001",
            deviceId: "device-relay-01",
            correlationId: "corr-001",
            commandType: "relay.set",
            payload: { channel: 1, value: false },
            requestedAt: "2026-05-10T09:00:01Z",
            status: "queued",
            attemptCount: 1,
            nextRetryAt: null
          }
        ]
      })
    });

    const history = await backend.getCommandHistory("device-relay-01");

    expect(history).toHaveLength(2);
    expect(history[0]?.commandId).toBe("cmd-002");
    expect(history[0]?.status).toBe("acknowledged");
  });

  it("caches snapshots between repeated reads until reset", async () => {
    const fetchDeviceSnapshot = vi.fn(async () => ({
      state: {
        deviceId: "device-relay-01",
        relayOn: false,
        lastTelemetry: "No telemetry yet",
        online: false,
        updatedAt: "2026-05-10T09:00:00Z"
      },
      commandHistory: []
    }));

    const cachedBackend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot
    });

    await cachedBackend.getState("device-relay-01");
    await cachedBackend.getCommandHistory("device-relay-01");

    expect(fetchDeviceSnapshot).toHaveBeenCalledTimes(2);

    cachedBackend.reset();
    await cachedBackend.getState("device-relay-01");

    expect(fetchDeviceSnapshot).toHaveBeenCalledTimes(3);
  });

  it("returns null and an empty history for an unknown device", async () => {
    const backend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot: async () => null
    });

    const state = await backend.getState("device-missing");
    const history = await backend.getCommandHistory("device-missing");

    expect(state).toBeNull();
    expect(history).toEqual([]);
  });

  it("persists queued, delivered, and acknowledged state into the mock Supabase store", async () => {
    const backend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot: async (deviceId) => {
        const stateRow = mockState.device_state.get(deviceId);
        if (!stateRow) {
          return null;
        }

        const commandRows = [...mockState.device_commands.values()]
          .filter((row) => row.device_id === deviceId)
          .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

        return {
          state: {
            deviceId: stateRow.device_id,
            relayOn: Boolean((stateRow.reported_state as { relay?: { value?: boolean } }).relay?.value),
            lastTelemetry: stateRow.last_reported_at
              ? `Last reported at ${stateRow.last_reported_at}`
              : "No telemetry yet",
            online: Boolean(stateRow.last_reported_at),
            updatedAt: stateRow.updated_at
          },
          commandHistory: commandRows.map((row) => ({
            commandId: row.id,
            deviceId: row.device_id,
            correlationId: row.correlation_id,
            commandType: row.command_type as CommandRequest["commandType"],
            payload: row.payload,
            requestedAt: row.requested_at,
            status: row.status,
            attemptCount: row.attempt_count,
            nextRetryAt: row.next_retry_at
          }))
        };
      }
    });

    const command: CommandRequest = {
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-write",
      payload: {
        channel: 1,
        value: true
      }
    };

    const queued = backend.queueCommand(command);
    await Promise.resolve();
    backend.markCommandDelivered(command.deviceId, queued.commandId);
    await Promise.resolve();

    const ack: AckPayload = {
      messageType: "ack",
      correlationId: command.correlationId,
      result: "ok",
      reportedState: {
        relay: {
          channel: 1,
          value: true
        }
      },
      reportedAt: "2026-05-10T09:00:04Z"
    };

    backend.applyAckPayload(command.deviceId, queued.commandId, ack);
    await Promise.resolve();

    const persisted = [...mockState.device_commands.values()].find(
      (entry) => entry.correlation_id === "corr-write"
    );
    const state = await backend.getState(command.deviceId);
    const history = await backend.getCommandHistory(command.deviceId);

    expect(persisted).toMatchObject({
      status: "acknowledged",
      acknowledged_at: "2026-05-10T09:00:04Z",
      attempt_count: 1
    });
    expect(mockState.device_state.get(command.deviceId)).toMatchObject({
      reported_state: {
        relay: {
          channel: 1,
          value: true
        }
      },
      last_reported_at: "2026-05-10T09:00:04Z"
    });
    expect(state?.deviceId).toBe("device-relay-01");
    expect(state?.relayOn).toBe(true);
    expect(state?.online).toBe(true);
    expect(history[0]).toMatchObject({
      commandId: queued.commandId,
      status: "acknowledged"
    });
  });

  it("requeues busy acks into persisted retry metadata", async () => {
    const backend = new SupabaseDeviceBackend({
      client: createMockSupabaseClient(mockState),
      fetchDeviceSnapshot: async (deviceId) => {
        const stateRow = mockState.device_state.get(deviceId);
        if (!stateRow) {
          return null;
        }

        const commandRows = [...mockState.device_commands.values()]
          .filter((row) => row.device_id === deviceId)
          .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

        return {
          state: {
            deviceId: stateRow.device_id,
            relayOn: Boolean((stateRow.reported_state as { relay?: { value?: boolean } }).relay?.value),
            lastTelemetry: stateRow.last_reported_at
              ? `Last reported at ${stateRow.last_reported_at}`
              : "No telemetry yet",
            online: true,
            updatedAt: stateRow.updated_at
          },
          commandHistory: commandRows.map((row) => ({
            commandId: row.id,
            deviceId: row.device_id,
            correlationId: row.correlation_id,
            commandType: row.command_type as CommandRequest["commandType"],
            payload: row.payload,
            requestedAt: row.requested_at,
            status: row.status,
            attemptCount: row.attempt_count,
            nextRetryAt: row.next_retry_at
          }))
        };
      }
    });

    const queued = backend.queueCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-busy-retry",
      payload: {
        channel: 1,
        value: true
      }
    });
    await Promise.resolve();
    backend.markCommandDelivered("device-relay-01", queued.commandId);
    await Promise.resolve();

    backend.applyAckPayload("device-relay-01", queued.commandId, {
      messageType: "ack",
      correlationId: "corr-busy-retry",
      result: "busy",
      reportedState: {
        relay: {
          channel: 1,
          value: true
        }
      },
      reportedAt: "2026-05-10T09:00:05Z"
    });
    await Promise.resolve();

    const persisted = [...mockState.device_commands.values()].find(
      (entry) => entry.correlation_id === "corr-busy-retry"
    );

    expect(persisted).toMatchObject({
      status: "queued",
      attempt_count: 2
    });
    expect(persisted?.next_retry_at).toBeTruthy();
  });
});

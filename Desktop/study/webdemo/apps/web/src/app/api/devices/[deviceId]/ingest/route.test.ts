import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getDeviceState, resetDeviceRuntime, seedDeviceState, queueDeviceCommand } from "@/lib/server/device-runtime";

const originalDeviceTokens = process.env.SMART_HOME_DEVICE_TOKENS;

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

describe("device ingest route", () => {
  beforeEach(() => {
    resetDeviceRuntime();
    delete process.env.SMART_HOME_DEVICE_TOKENS;
  });

  afterEach(() => {
    if (originalDeviceTokens === undefined) {
      delete process.env.SMART_HOME_DEVICE_TOKENS;
    } else {
      process.env.SMART_HOME_DEVICE_TOKENS = originalDeviceTokens;
    }
  });

  it("accepts a valid ack with correlationId match", async () => {
    // Seed device + queue a command
    seedDeviceState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "Idle",
      online: true,
      updatedAt: new Date().toISOString()
    });

    queueDeviceCommand({
      deviceId: "device-relay-01",
      commandType: "relay.set",
      correlationId: "corr-ingest-001",
      payload: { channel: 1, value: true }
    });

    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/ingest", {
        messageType: "ack",
        correlationId: "corr-ingest-001",
        result: "ok",
        reportedState: { relay: { channel: 1, value: true } },
        reportedAt: new Date().toISOString()
      }),
      { params: Promise.resolve({ deviceId: "device-relay-01" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.state.relayOn).toBe(true);
  });

  it("accepts a telemetry event and updates device online state", async () => {
    seedDeviceState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "",
      online: false,
      updatedAt: new Date().toISOString()
    });

    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/ingest", {
        messageType: "telemetry",
        deviceId: "device-relay-01",
        reportedAt: new Date().toISOString(),
        metrics: { temperatureC: 25, signalRssi: -55 },
        reportedState: { relay: { channel: 1, value: false } }
      }),
      { params: Promise.resolve({ deviceId: "device-relay-01" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.online).toBe(true);
    expect(payload.state.lastTelemetry).toContain("Temperature 25 C");
  });

  it("rejects ingest when a configured device token is missing", async () => {
    process.env.SMART_HOME_DEVICE_TOKENS = "device-relay-01=relay-secret";

    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/ingest", {
        messageType: "telemetry",
        deviceId: "device-relay-01",
        reportedAt: new Date().toISOString(),
        metrics: { temperatureC: 25 },
        reportedState: { relay: { channel: 1, value: false } }
      }),
      { params: Promise.resolve({ deviceId: "device-relay-01" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid device token");
    await expect(getDeviceState("device-relay-01")).resolves.toBeNull();
  });

  it("accepts ingest with the configured device token", async () => {
    process.env.SMART_HOME_DEVICE_TOKENS = "device-relay-01=relay-secret";

    const response = await POST(
      jsonRequest(
        "http://localhost:3000/api/devices/device-relay-01/ingest",
        {
          messageType: "telemetry",
          deviceId: "device-relay-01",
          reportedAt: new Date().toISOString(),
          metrics: { temperatureC: 26 },
          reportedState: { relay: { channel: 1, value: false } }
        },
        { "x-device-token": "relay-secret" }
      ),
      { params: Promise.resolve({ deviceId: "device-relay-01" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.online).toBe(true);
    expect(payload.state.lastTelemetry).toContain("Temperature 26 C");
  });

  it("rejects unknown messageType", async () => {
    seedDeviceState({
      deviceId: "device-relay-01",
      relayOn: false,
      lastTelemetry: "",
      online: true,
      updatedAt: new Date().toISOString()
    });

    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/ingest", {
        messageType: "unknown",
        data: {}
      }),
      { params: Promise.resolve({ deviceId: "device-relay-01" }) }
    );

    expect(response.status).toBe(400);
  });
});

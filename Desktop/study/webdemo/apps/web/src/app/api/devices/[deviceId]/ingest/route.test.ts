import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { resetDeviceRuntime, seedDeviceState, queueDeviceCommand } from "@/lib/server/device-runtime";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("device ingest route", () => {
  beforeEach(() => {
    resetDeviceRuntime();
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
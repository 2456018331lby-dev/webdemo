import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { resetDeviceRuntime } from "@/lib/server/device-runtime";

const originalCommandDelivery = process.env.SMART_HOME_COMMAND_DELIVERY;
const originalDeviceTokens = process.env.SMART_HOME_DEVICE_TOKENS;

function jsonRequest(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("device command route", () => {
  beforeEach(() => {
    resetDeviceRuntime();
    delete process.env.SMART_HOME_COMMAND_DELIVERY;
    delete process.env.SMART_HOME_DEVICE_TOKENS;
  });

  afterEach(() => {
    if (originalCommandDelivery === undefined) {
      delete process.env.SMART_HOME_COMMAND_DELIVERY;
    } else {
      process.env.SMART_HOME_COMMAND_DELIVERY = originalCommandDelivery;
    }

    if (originalDeviceTokens === undefined) {
      delete process.env.SMART_HOME_DEVICE_TOKENS;
    } else {
      process.env.SMART_HOME_DEVICE_TOKENS = originalDeviceTokens;
    }
  });

  it("returns a seeded device snapshot for a known device", async () => {
    const response = await GET(jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands"), {
      params: Promise.resolve({ deviceId: "device-relay-01" })
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.deviceId).toBe("device-relay-01");
    expect(Array.isArray(payload.commandHistory)).toBe(true);
  });

  it("applies lifecycle policies on GET without error", async () => {
    const response = await GET(jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands"), {
      params: Promise.resolve({ deviceId: "device-relay-01" })
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    // Lifecycle policies applied — state should still be valid
    expect(payload.state).toBeTruthy();
    expect(payload.state.deviceId).toBe("device-relay-01");
  });

  it("returns 404 for an unknown device snapshot request", async () => {
    const response = await GET(jsonRequest("http://localhost:3000/api/devices/device-missing-01/commands"), {
      params: Promise.resolve({ deviceId: "device-missing-01" })
    });

    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Device not found");
  });

  it("creates a command and returns an acknowledged update", async () => {
    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands", {
        commandType: "relay.set",
        correlationId: "corr-100",
        payload: {
          channel: 1,
          value: true
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ack.result).toBe("ok");
    expect(payload.state.relayOn).toBe(true);
    expect(payload.commandHistory[0].status).toBe("acknowledged");
  });

  it("returns queued retry state when the backend responds busy", async () => {
    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands", {
        commandType: "relay.set",
        correlationId: "corr-busy-sim-1",
        payload: {
          channel: 1,
          value: true
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.commandHistory[0].status).toBe("queued");
    expect(payload.ack.result).toBe("busy");
  });

  it("queues commands for ESP32S3 polling when polling delivery mode is enabled", async () => {
    process.env.SMART_HOME_COMMAND_DELIVERY = "polling";

    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands", {
        commandType: "relay.set",
        correlationId: "corr-polling-100",
        payload: {
          channel: 1,
          value: true
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.ack).toBeUndefined();
    expect(payload.command).toMatchObject({
      correlationId: "corr-polling-100",
      status: "queued"
    });
    expect(payload.commandHistory[0]).toMatchObject({
      correlationId: "corr-polling-100",
      status: "queued"
    });
  });

  it("lets ESP32S3 poll pending commands with a device token", async () => {
    process.env.SMART_HOME_COMMAND_DELIVERY = "polling";
    process.env.SMART_HOME_DEVICE_TOKENS = "device-relay-01=relay-secret";

    await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands", {
        commandType: "relay.set",
        correlationId: "corr-polling-101",
        payload: {
          channel: 1,
          value: true
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const response = await GET(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands?pending=true", undefined, {
        "x-device-token": "relay-secret"
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.commands).toEqual([
      expect.objectContaining({
        deviceId: "device-relay-01",
        messageType: "command",
        commandType: "relay.set",
        correlationId: "corr-polling-101",
        payload: { channel: 1, value: true }
      })
    ]);
    expect(payload.commandHistory[0]).toMatchObject({
      correlationId: "corr-polling-101",
      status: "delivered"
    });

    const secondResponse = await GET(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands?pending=true", undefined, {
        "x-device-token": "relay-secret"
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const secondPayload = await secondResponse.json();

    expect(secondPayload.commands).toEqual([]);
  });

  it("rejects pending command polling when a configured device token is missing", async () => {
    process.env.SMART_HOME_DEVICE_TOKENS = "device-relay-01=relay-secret";

    const response = await GET(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands?pending=true"),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid device token");
  });

  it("rejects malformed command payloads", async () => {
    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-01/commands", {
        commandType: "relay.set",
        correlationId: "corr-101",
        payload: {
          channel: "bad",
          value: "bad"
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-01" })
      }
    );

    expect(response.status).toBe(400);
  });

  it("rejects command requests for an offline device", async () => {
    const response = await POST(
      jsonRequest("http://localhost:3000/api/devices/device-relay-02/commands", {
        commandType: "relay.set",
        correlationId: "corr-102",
        payload: {
          channel: 1,
          value: true
        }
      }),
      {
        params: Promise.resolve({ deviceId: "device-relay-02" })
      }
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Device is offline");
  });
});

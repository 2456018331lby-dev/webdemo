import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { resetDeviceRuntime } from "@/lib/server/device-runtime";

function jsonRequest(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("device command route", () => {
  beforeEach(() => {
    resetDeviceRuntime();
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

import { describe, expect, it } from "vitest";
import { authenticateDeviceIngest } from "./device-token-auth";

describe("device token auth", () => {
  it("allows local development ingest when no device tokens are configured", () => {
    expect(authenticateDeviceIngest("device-relay-01", null, { NODE_ENV: "test" })).toEqual({ ok: true });
  });

  it("requires configured device tokens in production", () => {
    expect(authenticateDeviceIngest("device-relay-01", null, { NODE_ENV: "production" })).toEqual({
      ok: false,
      status: 503,
      error: "Device token authentication is not configured"
    });
  });

  it("matches exact device tokens and wildcard lab tokens", () => {
    const env = {
      NODE_ENV: "test",
      SMART_HOME_DEVICE_TOKENS: "device-relay-01=relay-secret,*=lab-token"
    };

    expect(authenticateDeviceIngest("device-relay-01", "relay-secret", env)).toEqual({ ok: true });
    expect(authenticateDeviceIngest("device-sensor-01", "lab-token", env)).toEqual({ ok: true });
    expect(authenticateDeviceIngest("device-relay-01", "wrong", env)).toEqual({
      ok: false,
      status: 401,
      error: "Invalid device token"
    });
  });
});

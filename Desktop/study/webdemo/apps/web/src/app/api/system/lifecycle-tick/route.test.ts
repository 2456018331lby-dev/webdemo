import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { resetDeviceRuntime } from "@/lib/server/device-runtime";

describe("lifecycle-tick route", () => {
  beforeEach(() => {
    resetDeviceRuntime();
  });

  it("returns ok with evaluatedAt timestamp", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(typeof payload.evaluatedAt).toBe("string");
    expect(new Date(payload.evaluatedAt).getTime()).toBeGreaterThan(0);
  });

  it("does not crash when lifecycle policies are applied with empty store", async () => {
    // After reset, store is empty — applying lifecycle policies should succeed
    const response = await POST();
    expect(response.status).toBe(200);
  });
});
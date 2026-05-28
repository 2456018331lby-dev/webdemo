import { afterEach, describe, expect, it, vi } from "vitest";

describe("device backend factory", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SMART_HOME_BACKEND;
  });

  it(
    "uses the in-memory backend by default",
    async () => {
      const { createDeviceBackend } = await import("./device-backend-factory");

      const backend = createDeviceBackend();

      expect(backend.constructor.name).toBe("InMemoryDeviceBackend");
    },
    15000
  );

  it("falls back to the in-memory backend when supabase is requested without env", async () => {
    process.env.SMART_HOME_BACKEND = "supabase";

    const { createDeviceBackend } = await import("./device-backend-factory");

    const backend = createDeviceBackend();

    expect(backend.constructor.name).toBe("InMemoryDeviceBackend");
  });

  it("creates the supabase backend skeleton when env is configured", async () => {
    process.env.SMART_HOME_BACKEND = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    const { createDeviceBackend } = await import("./device-backend-factory");

    const backend = createDeviceBackend();

    expect(backend.constructor.name).toBe("SupabaseDeviceBackend");
  });
});
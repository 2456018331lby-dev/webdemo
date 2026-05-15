import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DeviceBackend } from "./device-backend";
import { InMemoryDeviceBackend } from "./in-memory-device-backend";
import { SupabaseDeviceBackend } from "./supabase-device-backend";

function getRequestedBackend() {
  return process.env.SMART_HOME_BACKEND?.trim().toLowerCase() ?? "memory";
}

export function createDeviceBackend(): DeviceBackend {
  const requestedBackend = getRequestedBackend();

  if (requestedBackend === "supabase" && isSupabaseConfigured()) {
    return new SupabaseDeviceBackend();
  }

  return new InMemoryDeviceBackend();
}

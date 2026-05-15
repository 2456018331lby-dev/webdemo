type DeviceIngestPayload =
  | {
      messageType: "ack";
      deviceId: string;
      correlationId: string;
      result: "ok" | "rejected" | "busy" | "invalid_payload" | "unsafe_operation";
      reportedState: Record<string, unknown>;
      reportedAt: string;
    }
  | {
      messageType: "telemetry";
      deviceId: string;
      metrics: Record<string, unknown>;
      reportedState: Record<string, unknown>;
      reportedAt: string;
    }
  | {
      messageType: "error";
      deviceId: string;
      correlationId: string;
      errorCode: string;
      detail?: string;
    };

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = (await request.json()) as Partial<DeviceIngestPayload>;

  if (!payload.messageType || !payload.deviceId) {
    return json({ error: "Invalid ingest payload" }, { status: 400 });
  }

  return json({
    accepted: true,
    messageType: payload.messageType,
    note: "Skeleton only. Wire this function to Supabase tables and bridge authentication before production use."
  });
});

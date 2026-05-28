import { NextResponse } from "next/server";
import { applyLifecyclePolicies, getDeviceState, getCommandHistory } from "@/lib/server/device-runtime";
import { homes } from "@/lib/mock-data";

export async function GET() {
  const now = new Date().toISOString();
  applyLifecyclePolicies({ now });

  const result = await Promise.all(
    homes.map(async (home) => {
      let deviceCount = 0;
      let offlineCount = 0;
      let timedOutCount = 0;
      let failedCount = 0;
      let retryingCount = 0;

      const rooms = await Promise.all(
        home.rooms.map(async (room) => {
          const devices = await Promise.all(
            room.devices.map(async (d) => {
              deviceCount++;

              const state = await getDeviceState(d.id);
              const online = state?.online ?? d.online;
              if (!online) offlineCount++;

              const history = await getCommandHistory(d.id);
              const latest = history[0];

              if (latest) {
                if (latest.status === "timed_out") timedOutCount++;
                if (latest.status === "failed") failedCount++;
                if (latest.status === "queued" && (latest.attemptCount ?? 1) > 1) retryingCount++;
              }

              return {
                id: d.id,
                name: d.name,
                type: d.type,
                online,
                relayOn: state?.relayOn ?? d.relayOn,
                lastTelemetry: state?.lastTelemetry ?? d.lastTelemetry,
                latestCommandStatus: latest?.status ?? null,
                attemptCount: latest?.attemptCount ?? null,
                nextRetryAt: latest?.nextRetryAt ?? null
              };
            })
          );

          return {
            id: room.id,
            name: room.name,
            devices
          };
        })
      );

      return {
        id: home.id,
        name: home.name,
        memberRole: home.memberRole,
        deviceCount,
        offlineCount,
        timedOutCount,
        failedCount,
        retryingCount,
        rooms,
        evaluatedAt: now
      };
    })
  );

  return NextResponse.json({ homes: result });
}
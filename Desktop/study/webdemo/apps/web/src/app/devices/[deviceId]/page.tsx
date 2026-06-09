import { notFound } from "next/navigation";
import { DeviceCommandClient } from "@/components/device-command-client";
import { findDevice } from "@/lib/mock-data";
import {
  getDeviceState,
  getCommandHistory,
  applyLifecyclePolicies,
  seedDeviceState
} from "@/lib/server/device-runtime";

export default async function DevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const found = findDevice(deviceId);
  if (!found) notFound();

  let state = await getDeviceState(deviceId);
  if (!state) {
    seedDeviceState({
      deviceId: found.device.id,
      relayOn: found.device.relayOn,
      lastTelemetry: found.device.lastTelemetry,
      online: found.device.online,
      updatedAt: new Date().toISOString()
    });
    state = await getDeviceState(deviceId);
  }

  applyLifecyclePolicies({ now: new Date().toISOString() });
  state = await getDeviceState(deviceId);
  const history = await getCommandHistory(deviceId);
  if (!state) notFound();

  return (
    <main className="device-detail-main">
      <section className="app-shell device-detail-shell">
        <DeviceCommandClient
          deviceId={deviceId}
          homeName={found.home.name}
          roomName={found.room.name}
          deviceName={found.device.name}
          deviceType={found.device.type}
          initialRelayOn={state.relayOn}
          isOffline={!state.online}
          initialHistory={history}
          initialTelemetry={state.lastTelemetry}
        />
      </section>
    </main>
  );
}

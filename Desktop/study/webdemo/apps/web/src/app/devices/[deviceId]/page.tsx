import Link from "next/link";
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
    <main style={{ minHeight: "100vh", padding: "var(--space-page-y) var(--space-page-x) 56px" }}>
      <section className="app-shell" style={{ width: "min(1080px, 100%)" }}>
        <Link href="/homes" style={{ fontWeight: 800, color: "#dfeeff" }}>← 返回 homes</Link>

        <header className="hero-panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ maxWidth: "680px" }}>
              <p className="dark-label">{found.home.name} / {found.room.name}</p>
              <h1 style={{ margin: "14px 0 8px", fontSize: "42px", lineHeight: 1.04 }}>{found.device.name}</h1>
              <p className="dark-copy" style={{ margin: 0 }}>
                {found.device.type} · {state.relayOn ? "已开启" : "已关闭"} · {state.online ? "在线" : "离线"}
              </p>
            </div>
            <span style={{
              alignSelf: "flex-start", padding: "10px 14px", borderRadius: "var(--radius-pill)",
              background: state.online ? "rgba(25,141,85,0.12)" : "rgba(180,52,52,0.12)",
              color: state.online ? "#16653f" : "#9f2525",
              border: `1px solid ${state.online ? "rgba(25,141,85,0.18)" : "rgba(180,52,52,0.18)"}`,
              fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px"
            }}>
              {state.online ? "Online" : "Offline"}
            </span>
          </div>
        </header>

        <DeviceCommandClient
          deviceId={deviceId}
          deviceName={found.device.name}
          initialRelayOn={state.relayOn}
          isOffline={!state.online}
          initialHistory={history}
          initialTelemetry={state.lastTelemetry}
        />
      </section>
    </main>
  );
}
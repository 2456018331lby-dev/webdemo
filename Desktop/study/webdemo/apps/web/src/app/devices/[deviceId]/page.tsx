import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceCommandClient } from "@/components/device-command-client";
import { findDevice } from "@/lib/mock-data";

type DevicePageProps = {
  params: Promise<{
    deviceId: string;
  }>;
};

export default async function DevicePage({ params }: DevicePageProps) {
  const { deviceId } = await params;
  const result = findDevice(deviceId);

  if (!result) {
    notFound();
  }

  const { device, home, room } = result;

  return (
    <main style={{ minHeight: "100vh", padding: "36px" }}>
      <section style={{ width: "min(1080px, 100%)", margin: "0 auto", display: "grid", gap: "22px" }}>
        <Link href="/homes" style={{ fontWeight: 700, color: "#184865" }}>
          Back to homes
        </Link>

        <header
          style={{
            borderRadius: "26px",
            padding: "28px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(21, 48, 65, 0.08)",
            boxShadow: "0 18px 60px rgba(21, 48, 65, 0.10)"
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f7b96" }}>
            Device Detail
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: "42px", lineHeight: 1.04 }}>{device.name}</h1>
          <p style={{ margin: 0, color: "#4b6678", lineHeight: 1.6 }}>
            {home.name} / {room.name} / {device.type}. The current page demonstrates the command loop surface where desired state, reported state, and command acknowledgement are kept separate.
          </p>
        </header>

        <DeviceCommandClient
          deviceId={device.id}
          deviceName={device.name}
          initialRelayOn={device.relayOn}
          isOffline={!device.online}
        />

        <section
          style={{
            borderRadius: "24px",
            padding: "24px",
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(21, 48, 65, 0.08)",
            boxShadow: "0 18px 60px rgba(21, 48, 65, 0.08)"
          }}
        >
          <h2 style={{ margin: "0 0 14px", fontSize: "26px" }}>Telemetry and command notes</h2>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "#456072", lineHeight: 1.8 }}>
            <li>Latest telemetry: {device.lastTelemetry}</li>
            <li>Transport split: ESP32S3 handles connectivity, STM32H743 handles deterministic relay and sensing logic.</li>
            <li>Protocol priority: correlation id, command lifecycle, reported state confirmation, and timeout visibility.</li>
          </ul>
        </section>
      </section>
    </main>
  );
}

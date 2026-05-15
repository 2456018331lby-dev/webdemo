import Link from "next/link";
import { homes } from "@/lib/mock-data";

export default function HomesPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "36px" }}>
      <section style={{ width: "min(1180px, 100%)", margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "20px", marginBottom: "26px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "13px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f7b96" }}>
              Smart Home Dashboard
            </p>
            <h1 style={{ margin: "12px 0 8px", fontSize: "46px", lineHeight: 1.03 }}>Homes, rooms, and live device status</h1>
            <p style={{ margin: 0, maxWidth: "62ch", color: "#4b6678", lineHeight: 1.6 }}>
              This MVP dashboard focuses on one clear control loop: show assigned homes, inspect rooms, open a device, and send a command while keeping desired and reported state separate.
            </p>
          </div>
          <Link
            href="/devices/device-relay-01"
            style={{
              borderRadius: "16px",
              padding: "14px 18px",
              background: "#153041",
              color: "#fff",
              fontWeight: 700
            }}
          >
            Open sample device
          </Link>
        </header>

        <div style={{ display: "grid", gap: "24px" }}>
          {homes.map((home) => (
            <article
              key={home.id}
              style={{
                borderRadius: "26px",
                padding: "26px",
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(21, 48, 65, 0.08)",
                boxShadow: "0 18px 60px rgba(21, 48, 65, 0.10)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "30px" }}>{home.name}</h2>
                  <p style={{ margin: "8px 0 0", color: "#4b6678" }}>
                    Role: {home.memberRole}. Each room exposes online state, relay summary, and the next step into command detail.
                  </p>
                </div>
                <span
                  style={{
                    padding: "8px 12px",
                    borderRadius: "999px",
                    background: "rgba(40, 118, 165, 0.12)",
                    color: "#225f88",
                    fontWeight: 700,
                    fontSize: "13px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em"
                  }}
                >
                  {home.rooms.length} rooms
                </span>
              </div>

              <div style={{ display: "grid", gap: "16px", marginTop: "22px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {home.rooms.map((room) => (
                  <section
                    key={room.id}
                    style={{
                      borderRadius: "20px",
                      padding: "20px",
                      background: "#f3f8fb",
                      border: "1px solid rgba(21, 48, 65, 0.06)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "22px" }}>{room.name}</h3>
                        <p style={{ margin: "6px 0 0", color: "#628196" }}>{room.devices.length} devices</p>
                      </div>
                    </div>

                    <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: "12px" }}>
                      {room.devices.map((device) => (
                        <li
                          key={device.id}
                          style={{
                            borderRadius: "16px",
                            padding: "14px",
                            background: "#ffffff",
                            display: "grid",
                            gap: "8px"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                            <strong>{device.name}</strong>
                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: "999px",
                                background: device.online ? "rgba(25, 141, 85, 0.12)" : "rgba(180, 52, 52, 0.12)",
                                color: device.online ? "#16653f" : "#9f2525",
                                fontSize: "12px",
                                fontWeight: 700
                              }}
                            >
                              {device.online ? "Online" : "Offline"}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: "#4b6678", fontSize: "14px" }}>{device.lastTelemetry}</p>
                          <Link href={`/devices/${device.id}`} style={{ fontWeight: 700, color: "#174766" }}>
                            Open device detail
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

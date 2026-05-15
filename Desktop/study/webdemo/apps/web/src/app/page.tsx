import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px"
      }}
    >
      <section
        style={{
          width: "min(860px, 100%)",
          borderRadius: "28px",
          padding: "40px",
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(21, 48, 65, 0.08)",
          boxShadow: "0 18px 60px rgba(21, 48, 65, 0.12)"
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f7b96" }}>
          Smart Home Management
        </p>
        <h1 style={{ margin: "14px 0 10px", fontSize: "48px", lineHeight: 1.02 }}>
          Connected product MVP is now scaffolded.
        </h1>
        <p style={{ margin: 0, maxWidth: "54ch", fontSize: "18px", lineHeight: 1.6, color: "#456072" }}>
          Next steps are the shared device contract, Supabase schema, and the end-to-end
          command loop between dashboard, ESP32S3, and STM32H743.
        </p>
        <div style={{ marginTop: "28px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <Link
            href="/homes"
            style={{
              borderRadius: "16px",
              padding: "14px 18px",
              background: "#153041",
              color: "#fff",
              fontWeight: 700
            }}
          >
            Open homes dashboard
          </Link>
          <Link
            href="/devices/device-relay-01"
            style={{
              borderRadius: "16px",
              padding: "14px 18px",
              background: "#dfeaf0",
              color: "#17384b",
              fontWeight: 700
            }}
          >
            Open device detail
          </Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "var(--space-page-y) var(--space-page-x) 56px" }}>
      <section className="app-shell">
        <header className="hero-panel" style={{ padding: "36px" }}>
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={{ maxWidth: "760px", display: "grid", gap: "12px" }}>
              <p className="dark-label">Smart Home Control</p>
              <h1 style={{ margin: 0, fontSize: "52px", lineHeight: 1.02 }}>
                STM32H743 + ESP32S3 智能家居控制台
              </h1>
              <p className="dark-copy" style={{ margin: 0, maxWidth: "66ch", fontSize: "17px" }}>
                网页端直接下发控制命令，实时追踪命令生命周期（排队→送达→确认/超时/失败），一眼看清设备状态、链路风险和操作建议。
              </p>
            </div>

            <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <article className="metric-card">
                <div style={{ fontSize: "12px", color: "#a7c2ea", textTransform: "uppercase", letterSpacing: "0.08em" }}>控制链路</div>
                <strong style={{ display: "block", marginTop: "10px", fontSize: "22px", lineHeight: 1.35 }}>Web → ESP32S3 → STM32H743</strong>
                <p style={{ margin: "10px 0 0", color: "rgba(232,242,255,0.78)", lineHeight: 1.6, fontSize: "14px" }}>
                  命令从浏览器发出，经 ESP32S3 桥接，送达 STM32H743 执行并回传确认。
                </p>
              </article>
              <article className="metric-card">
                <div style={{ fontSize: "12px", color: "#a7c2ea", textTransform: "uppercase", letterSpacing: "0.08em" }}>状态追踪</div>
                <strong style={{ display: "block", marginTop: "10px", fontSize: "22px", lineHeight: 1.35 }}>排队 · 送达 · 确认 · 超时 · 失败</strong>
                <p style={{ margin: "10px 0 0", color: "rgba(232,242,255,0.78)", lineHeight: 1.6, fontSize: "14px" }}>
                  每条命令全程可视，异常时自动重试并给出操作建议。
                </p>
              </article>
              <article className="metric-card">
                <div style={{ fontSize: "12px", color: "#a7c2ea", textTransform: "uppercase", letterSpacing: "0.08em" }}>风险感知</div>
                <strong style={{ display: "block", marginTop: "10px", fontSize: "22px", lineHeight: 1.35 }}>可靠度 · 风险等级 · 冷却建议</strong>
                <p style={{ margin: "10px 0 0", color: "rgba(232,242,255,0.78)", lineHeight: 1.6, fontSize: "14px" }}>
                  根据遥测数据实时评估，告诉操作员现在该不该动手。
                </p>
              </article>
            </div>

            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <Link href="/homes" className="primary-cta">全局健康度</Link>
              <Link href="/devices/device-relay-01" className="secondary-cta">直接控制 Main Light Relay</Link>
            </div>
          </div>
        </header>

        <section className="surface-panel">
          <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <article className="info-card">
              <div className="info-label">全局概览</div>
              <strong className="info-value" style={{ fontSize: "22px", lineHeight: 1.4 }}>系统稳不稳、哪里该先看</strong>
              <p className="info-copy">设备在线/离线数、命令超时/失败统计、各房间健康度一目了然。</p>
            </article>
            <article className="info-card">
              <div className="info-label">设备控制</div>
              <strong className="info-value" style={{ fontSize: "22px", lineHeight: 1.4 }}>能不能控、为什么不该控</strong>
              <p className="info-copy">实时可靠度、操作风险等级、冷却倒计时、命令生命周期全部可见。</p>
            </article>
            <article className="info-card">
              <div className="info-label">后续规划</div>
              <strong className="info-value" style={{ fontSize: "22px", lineHeight: 1.4 }}>Supabase 持久化 · 真实硬件对接</strong>
              <p className="info-copy">当前 in-memory demo 已打通控制链路，下步接入 Supabase 数据库和真实 MCU 硬件。</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
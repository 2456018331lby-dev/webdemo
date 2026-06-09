import Link from "next/link";
import { OfflineRecoveryPanel } from "./offline-recovery-panel";

export default function OfflinePage() {
  return (
    <div className="page-grid">
      <section className="hero hero-command animate-fade-in-up">
        <div className="offline-hero-layout">
          <div>
            <div className="hero-label">
              <span>📴</span>
              <span>离线模式</span>
            </div>
            <h1 className="hero-title">当前网络不可用</h1>
            <p className="hero-description">
              应用壳层仍然可打开，但实时状态和命令下发需要恢复网络。回到在线环境后，页面会继续刷新最新设备状态。
            </p>
            <div className="hero-actions">
              <Link href="/" className="btn btn-primary btn-lg">
                返回首页
              </Link>
              <Link href="/homes" className="btn btn-secondary btn-lg">
                打开总览
              </Link>
            </div>
          </div>
          <OfflineRecoveryPanel />
        </div>
      </section>
    </div>
  );
}

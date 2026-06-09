import Link from "next/link";
import { applyLifecyclePolicies, getCommandHistory, getDeviceState } from "@/lib/server/device-runtime";
import { homes } from "@/lib/mock-data";
import { getRecentLogs } from "@/lib/activity-logs";
import { buildLandingDashboardSummary } from "@/lib/landing-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date().toISOString();
  applyLifecyclePolicies({ now });

  const dashboard = await buildLandingDashboardSummary(homes, {
    getDeviceState,
    getCommandHistory
  });
  const {
    attentionDevices,
    failedCommands,
    offlineDevices,
    onlineDevices,
    onlineRate,
    priorityActions,
    retryingCommands,
    roomFocus,
    timedOutCommands,
    totalDevices
  } = dashboard;
  const recentLogs = getRecentLogs(4);

  return (
    <div className="page-grid">
      <section className="hero hero-command animate-fade-in-up">
        <div className="hero-command-grid">
          <div>
            <div className="hero-label">
              <span>⚡</span>
              <span>家庭控制中枢</span>
            </div>
            <h1 className="hero-title">
              把你的房间装进一块
              <br />
              随手可控的控制面板
            </h1>
            <p className="hero-description">
              现在的版本已经能直接当成移动端控制台使用：设备状态、命令追踪、离线告警和房间总览都集中在一个界面里，
              同时支持安装到安卓桌面，打开就像原生 App。
            </p>

            <div className="summary-strip">
              <div className="summary-pill">
                <span className="summary-pill__label">在线率</span>
                <strong>{onlineRate}%</strong>
              </div>
              <div className="summary-pill">
                <span className="summary-pill__label">关注项</span>
                <strong>{attentionDevices}</strong>
              </div>
              <div className="summary-pill">
                <span className="summary-pill__label">重试中的命令</span>
                <strong>{retryingCommands}</strong>
              </div>
            </div>

            <div className="hero-actions">
              <Link href="/homes" className="btn btn-primary btn-lg">
                打开总览
              </Link>
              <Link href="/devices" className="btn btn-secondary btn-lg">
                进入设备墙
              </Link>
              <Link href="/#install-app" className="btn btn-ghost btn-lg hero-actions__install">
                安装到手机
              </Link>
            </div>
          </div>

          <aside className="hero-console">
            <div className="hero-console-card">
              <div className="hero-console-card__label">系统就绪</div>
              <div className="hero-console-card__value">PWA Ready</div>
              <p>已补齐安装清单、离线页和生产模式 Service Worker，适合先作为安卓主屏应用使用。</p>
            </div>
            <div className="hero-console-card hero-console-card--accent">
              <div className="hero-console-card__label">当前态势</div>
              <div className="hero-console-card__value">{onlineDevices}/{totalDevices}</div>
              <p>{offlineDevices > 0 ? `有 ${offlineDevices} 台设备离线，建议先处理链路` : "全链路在线，适合继续控制和巡检"}</p>
            </div>
            <div className="hero-console-card">
              <div className="hero-console-card__label">下一步</div>
              <ul className="hero-checklist">
                <li>先把应用安装到手机桌面</li>
                <li>从总览页定位离线和超时设备</li>
                <li>进入设备页做快速控制与确认</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="stat-grid animate-fade-in-up delay-1">
        <div className="stat-card">
          <div className="stat-label">总设备</div>
          <div className="stat-value">{totalDevices}</div>
          <div className="stat-change neutral">覆盖 {homes.length} 个家庭空间</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在线设备</div>
          <div className="stat-value stat-value--success">{onlineDevices}</div>
          <div className="stat-change positive">适合继续控制</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">离线设备</div>
          <div className={`stat-value ${offlineDevices > 0 ? "stat-value--danger" : "stat-value--success"}`}>{offlineDevices}</div>
          <div className={`stat-change ${offlineDevices > 0 ? "negative" : "positive"}`}>
            {offlineDevices > 0 ? "需要巡检链路" : "当前无离线"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">失败/超时命令</div>
          <div className={`stat-value ${attentionDevices > 0 ? "stat-value--warning" : "stat-value--success"}`}>
            {timedOutCommands + failedCommands}
          </div>
          <div className={`stat-change ${timedOutCommands + failedCommands > 0 ? "negative" : "positive"}`}>
            {timedOutCommands + failedCommands > 0 ? "需要回看日志" : "命令链路平稳"}
          </div>
        </div>
      </section>

      <section className="dashboard-band animate-fade-in-up delay-2">
        <div className="card install-guide" id="install-app">
          <div className="card-header">
            <div>
              <h2 className="card-title">安装到安卓主屏</h2>
              <p className="card-subtitle">先把它装成随手能开的控制面板，再考虑 APK 包装壳。</p>
            </div>
            <span className="badge badge-success">推荐入口</span>
          </div>
          <div className="install-guide__steps">
            <div className="install-guide__step">
              <span>1</span>
              <div>
                <strong>在 Android Chrome 打开应用</strong>
                <p>进入首页后，如果浏览器支持，会自动出现安装提示。</p>
              </div>
            </div>
            <div className="install-guide__step">
              <span>2</span>
              <div>
                <strong>点“安装”加入桌面</strong>
                <p>安装后会以独立窗口启动，不再像普通网页标签页。</p>
              </div>
            </div>
            <div className="install-guide__step">
              <span>3</span>
              <div>
                <strong>离线时至少保留壳层与提示页</strong>
                <p>断网后仍能打开应用壳和离线兜底页，恢复网络即可继续轮询状态。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">优先处理</h2>
              <p className="card-subtitle">先把风险最高的设备处理掉，体验会明显更顺。</p>
            </div>
          </div>
          <div className="timeline-list">
            {priorityActions.map((action) => (
              <div key={action.id} className="timeline-item" data-tone={action.tone}>
                <div className={`timeline-dot timeline-dot--${action.tone}`}></div>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                </div>
                <Link href={action.href} className="timeline-action-link">
                  {action.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card animate-fade-in-up delay-3">
        <div className="card-header">
          <div>
            <h2 className="card-title">房间焦点</h2>
            <p className="card-subtitle">按房间快速切入，不用先翻完整设备列表。</p>
          </div>
        </div>
        <div className="focus-grid">
          {roomFocus.map((room) => (
            <Link key={room.id} href={`/devices/${room.featuredDeviceId}`} className="focus-card">
              <div className="focus-card__topline">
                <span>{room.homeName}</span>
                <span>{room.attentionCount > 0 ? `${room.attentionCount} 个关注项` : "运行稳定"}</span>
              </div>
              <h3>{room.roomName}</h3>
              <p>{room.onlineCount}/{room.deviceCount} 台设备在线</p>
              <div className="focus-card__meta">
                <strong>{room.featuredDeviceName}</strong>
                <span>{room.featuredTelemetry}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card animate-fade-in-up delay-4">
        <div className="card-header">
          <div>
            <h2 className="card-title">最近动态</h2>
            <p className="card-subtitle">进入系统后的第一屏就应该能回答“刚刚发生了什么”。</p>
          </div>
          <Link href="/activity" className="btn btn-ghost btn-sm">
            查看全部日志
          </Link>
        </div>
        <div className="timeline-list">
          {recentLogs.map((log) => (
            <div key={log.id} className="timeline-item">
              <div className={`timeline-dot ${log.level === "error" ? "timeline-dot--danger" : log.level === "warning" ? "timeline-dot--warning" : "timeline-dot--success"}`}></div>
              <div>
                <strong>{log.title}</strong>
                <p>{log.message}</p>
              </div>
              {log.deviceId ? (
                <Link href={`/devices/${log.deviceId}`} className="timeline-link">
                  查看设备
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

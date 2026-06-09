"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

type NetworkState = "checking" | "online" | "offline";

function getNetworkState(): NetworkState {
  if (typeof navigator === "undefined") {
    return "checking";
  }

  return navigator.onLine ? "online" : "offline";
}

export function OfflineRecoveryPanel() {
  const [networkState, setNetworkState] = useState<NetworkState>("checking");

  const refreshNetworkState = useCallback(() => {
    setNetworkState(getNetworkState());
  }, []);

  useEffect(() => {
    refreshNetworkState();

    window.addEventListener("online", refreshNetworkState);
    window.addEventListener("offline", refreshNetworkState);

    return () => {
      window.removeEventListener("online", refreshNetworkState);
      window.removeEventListener("offline", refreshNetworkState);
    };
  }, [refreshNetworkState]);

  const isOnline = networkState === "online";

  return (
    <aside className="offline-recovery-panel">
      <div className="offline-recovery-panel__label">恢复检查</div>
      <div className="offline-recovery-status" data-state={networkState} role="status" aria-live="polite">
        <span className="offline-recovery-status__dot"></span>
        <span>
          {networkState === "checking" && "正在检测网络连接"}
          {networkState === "online" && "网络已恢复，可以返回控制台"}
          {networkState === "offline" && "仍处于离线状态，实时控制已暂停"}
        </span>
      </div>

      <ul className="offline-recovery-list">
        <li>保留应用壳、安装入口和离线说明</li>
        <li>恢复网络后重新进入总览刷新设备状态</li>
        <li>命令下发前先确认 ESP32S3 / Wi-Fi 链路</li>
      </ul>

      <div className="offline-recovery-actions">
        {isOnline ? (
          <Link href="/" className="btn btn-primary">
            回到控制台
          </Link>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={refreshNetworkState}>
            重新检测
          </button>
        )}
        <Link href="/activity" className="btn btn-ghost offline-recovery-actions__secondary">
          查看最近日志
        </Link>
      </div>
    </aside>
  );
}

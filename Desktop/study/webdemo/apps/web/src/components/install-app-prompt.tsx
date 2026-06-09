"use client";

import { useEffect, useMemo, useState } from "react";

type PromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<PromptChoice>;
}

const DISMISS_KEY = "smart-home-install-dismissed-v1";

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    setStandalone(isStandaloneDisplay());

    const onBeforeInstall = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setPromptEvent(installEvent);
      setDismissed(false);
    };

    const onInstalled = () => {
      setStandalone(true);
      setPromptEvent(null);
    };

    const media = window.matchMedia("(display-mode: standalone)");
    const onMediaChange = (event: MediaQueryListEvent) => {
      setStandalone(event.matches);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    media.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  if (standalone || dismissed || (!promptEvent && !ios)) {
    return null;
  }

  async function handleInstall() {
    if (!promptEvent) {
      return;
    }

    setInstalling(true);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setInstalling(false);

    if (choice.outcome === "accepted") {
      setPromptEvent(null);
      return;
    }

    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <aside className={`install-prompt ${compact ? "install-prompt--compact" : ""}`} aria-live="polite">
      <div className="install-prompt__content">
        <strong>{compact ? "安装 App" : "安装到手机桌面"}</strong>
        {!compact && (
          <p>
            {promptEvent
              ? "把控制台安装成独立应用，打开更快，也更像原生安卓面板。"
              : "在 Safari 点击分享，再选择“添加到主屏幕”，也能获得接近原生的体验。"}
          </p>
        )}
      </div>
      <div className="install-prompt__actions">
        {promptEvent ? (
          <button className="btn btn-primary btn-sm" onClick={handleInstall} disabled={installing}>
            {installing ? "安装中..." : "立即安装"}
          </button>
        ) : (
          <span className="badge badge-info">iPhone 手动安装</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
          稍后
        </button>
      </div>
    </aside>
  );
}

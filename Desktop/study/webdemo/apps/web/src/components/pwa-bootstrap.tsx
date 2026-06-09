"use client";

import { useEffect } from "react";

export function PwaBootstrap() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none"
    }).catch(() => {
      // Best-effort PWA registration. The web app should still work without it.
    });
  }, []);

  return null;
}

import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-display"
});

const bodyFont = Noto_Sans_SC({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
  preload: false
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "智能家居控制系统",
    template: "%s · 智能家居控制系统"
  },
  description: "STM32H743 + ESP32S3 智能家居管理平台，支持移动端安装、命令追踪、全局健康度监控和设备控制。",
  applicationName: "智能家居控制系统",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "智能家居",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-maskable.svg", type: "image/svg+xml", rel: "mask-icon" }
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071120",
  interactiveWidget: "resizes-visual"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

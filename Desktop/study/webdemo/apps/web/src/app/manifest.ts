import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "智能家居控制系统",
    short_name: "智能家居",
    description: "STM32H743 + ESP32S3 智能家居控制台，支持移动端安装、命令追踪和全局健康度监控。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#071120",
    theme_color: "#071120",
    lang: "zh-CN",
    categories: ["productivity", "utilities", "smart-home"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "全局健康度",
        short_name: "健康度",
        description: "快速查看所有家庭和设备的健康状态",
        url: "/homes"
      },
      {
        name: "所有设备",
        short_name: "设备",
        description: "进入设备列表，快速开始控制",
        url: "/devices"
      }
    ]
  };
}

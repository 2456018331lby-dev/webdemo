# 🏠 Smart Home System

STM32H743 + ESP32S3 智能家居控制系统

## 🚀 快速启动

### Windows
双击 `start.bat` 或在命令行运行：
```cmd
start.bat
```

### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

### 手动启动
```bash
npm install  # 首次运行需要安装依赖
npm run dev  # 启动开发服务器
```

启动后访问: **http://localhost:3000**

## 📁 项目结构

```
webdemo/
├── apps/
│   └── web/                    # Next.js 前端应用
│       ├── src/
│       │   ├── app/            # App Router 页面
│       │   ├── components/     # React 组件
│       │   └── lib/            # 工具函数和数据
│       └── package.json
├── docs/                       # 项目文档
│   ├── hardware/               # 硬件集成文档
│   └── maintenance/            # 维护文档
├── supabase/                   # Supabase 迁移
├── start.bat                   # Windows 启动脚本
├── start.sh                    # Linux/Mac 启动脚本
└── README.md                   # 本文件
```

## 🎯 功能特性

- ✅ 设备控制面板（继电器开关）
- ✅ 命令生命周期追踪（排队→送达→确认/超时/失败）
- ✅ 全局健康度仪表盘
- ✅ SSR 首屏渲染，无闪白
- ✅ 实时状态轮询（5-15秒）
- ✅ 硬件集成接口（ESP32S3 上行 API）

## 🔗 主要页面

| 页面 | URL | 说明 |
|------|-----|------|
| 首页 | `/` | 系统概览和快速导航 |
| 全局健康度 | `/homes` | 所有家庭和设备状态 |
| 设备详情 | `/devices/[id]` | 单个设备控制和状态 |

## 📡 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/devices/[id]/commands` | GET/POST | 命令管理 |
| `/api/devices/[id]/ingest` | POST | 设备上行数据（ESP32S3） |
| `/api/system/lifecycle-tick` | POST | 生命周期轮询 |
| `/api/homes/snapshot` | GET | 聚合统计数据 |

## 🧪 测试

```bash
npm run test        # 运行所有测试
npm run lint        # 代码检查
npm run build       # 构建生产版本
```

## 📚 文档

- [硬件集成指南](docs/hardware/integration-guide.md)
- [项目交接文档](docs/maintenance/project-handoff.md)
- [任务看板](docs/maintenance/task-board.md)
- [进度日志](docs/maintenance/progress-log.md)

## 🛠️ 技术栈

- **前端**: Next.js 15 (App Router) + React 19 + TypeScript
- **样式**: CSS Variables + 自定义设计系统
- **后端**: InMemoryDeviceBackend (开发) / Supabase (计划)
- **硬件**: ESP32S3 + STM32H743

## 📝 开发说明

### 添加新设备
编辑 `apps/web/src/lib/mock-data.ts` 添加设备数据。

### 修改样式
编辑 `apps/web/src/app/globals.css` 中的 CSS 变量。

### 运行测试
```bash
npm run test        # 运行测试
npm run test:watch  # 监听模式
```

## 🐛 常见问题

### 端口被占用
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# Linux/Mac
lsof -i :3000
kill -9 <进程ID>
```

### 依赖安装失败
```bash
# 清除缓存
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

Private - 仅用于学习和开发

#!/bin/bash
# Smart Home System 启动脚本
# 使用方法: ./start.sh

cd "$(dirname "$0")"

echo "🏠 启动智能家居控制系统..."
echo ""

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo "🚀 启动开发服务器..."
echo "   访问地址: http://localhost:3000"
echo ""
echo "   按 Ctrl+C 停止服务器"
echo ""

npm run dev

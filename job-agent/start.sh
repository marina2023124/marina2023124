#!/bin/bash
set -e

echo "🚀 JobAgent 启动脚本"
echo ""

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "❌ 未找到 Node.js，请先安装：https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"
echo "✓ npm $(npm -v)"

# 确保在 job-agent 目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 安装依赖
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 首次运行，安装依赖..."
  npm install
fi

# 检查 Supabase 配置
if [ ! -f ".env.local" ]; then
  echo ""
  echo "⚠️  尚未配置 Supabase（.env.local 不存在）"
  echo "   启动后打开 http://localhost:3000 按页面向导完成配置"
  echo ""
fi

echo ""
echo "▶  启动开发服务器..."
echo "   浏览器访问: http://localhost:3000"
echo "   按 Ctrl+C 停止"
echo ""

npm run dev

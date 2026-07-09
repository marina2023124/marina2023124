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

LAST_VER=""
[ -f ".last-build-version" ] && LAST_VER=$(cat .last-build-version)
CUR_VER=""
[ -f "VERSION" ] && CUR_VER=$(cat VERSION)

if [ "${CLEAN:-0}" = "1" ] && [ -d ".next" ]; then
  echo "🧹 清理旧缓存..."
  rm -rf .next
elif [ -n "$CUR_VER" ] && [ "$CUR_VER" != "$LAST_VER" ] && [ -d ".next" ]; then
  echo "🧹 检测到新版本 ${CUR_VER}，清理 .next 缓存（避免 layout.js 404）..."
  rm -rf .next
fi
[ -n "$CUR_VER" ] && echo "$CUR_VER" > .last-build-version

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
if [ "${PROD:-1}" = "1" ]; then
  echo "▶  启动生产模式（页面切换更快）..."
  echo "   开发模式请用: PROD=0 ./start.sh"
  npm run build
  echo ""
  echo "   浏览器访问: http://localhost:3000"
  echo "   按 Ctrl+C 停止"
  echo ""
  npm start
else
  echo "▶  启动开发服务器（首次打开页面会较慢）..."
  echo "   浏览器访问: http://localhost:3000"
  echo "   按 Ctrl+C 停止"
  echo ""
  npm run dev
fi

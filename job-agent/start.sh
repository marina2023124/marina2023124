#!/bin/bash
set -e

echo "🚀 JobAgent 启动脚本"
echo ""

if ! command -v node &>/dev/null; then
  echo "❌ 未找到 Node.js，请先安装：https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"
echo "✓ npm $(npm -v)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LAST_VER=""
[ -f ".last-build-version" ] && LAST_VER=$(cat .last-build-version)
CUR_VER=""
[ -f "VERSION" ] && CUR_VER=$(cat VERSION)
[ -n "$CUR_VER" ] && echo "✓ 版本 ${CUR_VER}"

if [ "${CLEAN:-0}" = "1" ] && [ -d ".next" ]; then
  echo "🧹 清理旧缓存..."
  rm -rf .next
elif [ -n "$CUR_VER" ] && [ "$CUR_VER" != "$LAST_VER" ] && [ -d ".next" ]; then
  echo "🧹 检测到新版本 ${CUR_VER}，清理 .next 缓存（避免 layout.js 404）..."
  rm -rf .next
fi
[ -n "$CUR_VER" ] && echo "$CUR_VER" > .last-build-version

if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 首次运行，安装依赖..."
  npm install
fi

if [ ! -f ".env.local" ]; then
  echo ""
  echo "⚠️  尚未配置 Supabase（.env.local 不存在）"
  echo "   启动后打开 http://localhost:3000 按页面向导完成配置"
  echo ""
fi

echo ""
export ALLOW_SETUP_CONFIGURE=1

free_port() {
  if command -v fuser &>/dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 1
    return
  fi
  if command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "🧹 释放 3000 端口..."
      kill -9 $PIDS 2>/dev/null || true
      sleep 1
    fi
  fi
}

if [ "${PROD:-1}" = "1" ]; then
  echo "▶  启动生产模式（页面切换更快）..."
  echo "   开发模式: PROD=0 ./start.sh"
  echo "   强制清缓存: CLEAN=1 ./start.sh"
  echo "   跳过构建: SKIP_BUILD=1 ./start.sh（仅当版本未变且 .next 完好）"

  if [ "${SKIP_BUILD:-0}" = "1" ] && [ -f ".next/BUILD_ID" ] && [ -n "$CUR_VER" ] && [ "$CUR_VER" = "$LAST_VER" ]; then
    echo "⏭  跳过 npm run build（SKIP_BUILD=1）"
  else
    if ! npm run build; then
      echo ""
      echo "❌ 构建失败。可尝试: CLEAN=1 ./start.sh"
      exit 1
    fi
  fi

  echo ""
  echo "   浏览器访问: http://localhost:3000"
  echo "   若打不开: CLEAN=1 PROD=1 ./start.sh 后 Cmd+Shift+R 强刷"
  echo "   按 Ctrl+C 停止"
  echo ""
  free_port
  npm start
else
  echo "▶  启动开发服务器..."
  echo "   浏览器访问: http://localhost:3000"
  echo "   按 Ctrl+C 停止"
  echo ""
  free_port
  npm run dev
fi

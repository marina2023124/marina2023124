#!/bin/bash
# JobAgent 一键修复并启动（打不开页面时用）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 JobAgent 一键修复"
echo ""

free_port() {
  if command -v fuser &>/dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
  elif command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti :3000 2>/dev/null || true)
    [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
  fi
  sleep 1
}

echo "1/4 释放 3000 端口..."
free_port

echo "2/4 清理构建缓存..."
rm -rf .next

echo "3/4 安装依赖（如需）..."
[ ! -d node_modules ] && npm install

echo "4/4 构建并启动..."
export ALLOW_SETUP_CONFIGURE=1
npm run build

echo ""
echo "✅ 构建完成。正在启动..."
echo "   访问 http://localhost:3000"
echo "   若浏览器仍异常 → Cmd+Shift+R 强刷"
echo "   诊断命令: ./doctor.sh"
echo ""

free_port
npm start

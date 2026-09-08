#!/bin/bash
# JobAgent 一键修复并启动（打不开页面时用）
# 用法：bash fix-and-start.sh  （无需 chmod）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 JobAgent 一键修复"
echo ""

detect_local_proxy() {
  if [ -n "$HTTPS_PROXY" ] || [ -n "$HTTP_PROXY" ]; then
    echo "   代理: ${HTTPS_PROXY:-$HTTP_PROXY}"
    return
  fi

  if [ -f .env.local ]; then
    local env_proxy
    env_proxy=$(grep -E '^(HTTPS_PROXY|HTTP_PROXY)=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$env_proxy" ]; then
      export HTTPS_PROXY="$env_proxy"
      export HTTP_PROXY="$env_proxy"
      echo "   已从 .env.local 加载代理: ${HTTPS_PROXY}"
      return
    fi
  fi

  for port in 7890 7897 1087 1080 8118; do
    if command -v lsof &>/dev/null && lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      export HTTPS_PROXY="http://127.0.0.1:${port}"
      export HTTP_PROXY="http://127.0.0.1:${port}"
      echo "   检测到 Clash/代理端口 ${port}，已设置 HTTPS_PROXY=${HTTPS_PROXY}"
      return
    fi
  done

  echo "   ⚠️  未检测到代理。Clash 用户请在 .env.local 添加："
  echo "   HTTPS_PROXY=http://127.0.0.1:7890"
  echo "   然后重新运行 bash fix-and-start.sh"
}

free_port() {
  if command -v fuser &>/dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
  elif command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti :3000 2>/dev/null || true)
    [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
  fi
  sleep 1
}

echo "1/5 检测代理（本机服务连 Supabase 需要）..."
detect_local_proxy
echo ""

echo "2/5 释放 3000 端口..."
free_port

echo "3/5 清理构建缓存..."
rm -rf .next

echo "4/5 安装依赖（如需）..."
[ ! -d node_modules ] && npm install

echo "5/5 构建并启动..."
export ALLOW_SETUP_CONFIGURE=1
npm run build

echo ""
echo "✅ 构建完成。正在启动..."
echo "   访问 http://localhost:3000"
echo "   若浏览器仍异常 → Cmd+Shift+R 强刷"
echo "   诊断命令: bash doctor.sh"
echo ""

free_port
npm start

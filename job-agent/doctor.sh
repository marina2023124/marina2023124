#!/bin/bash
# JobAgent 环境诊断
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== JobAgent 诊断 ==="
echo ""

ok() { echo "✓ $1"; }
fail() { echo "✗ $1"; }

if command -v node &>/dev/null; then
  ok "Node.js $(node -v)"
else
  fail "未安装 Node.js"
fi

if [ -f "VERSION" ]; then
  ok "版本 $(cat VERSION)"
else
  fail "缺少 VERSION 文件"
fi

if [ -d "node_modules" ]; then
  ok "node_modules 存在"
else
  fail "请运行 npm install"
fi

if [ -d ".next" ]; then
  ok ".next 构建目录存在"
else
  fail ".next 不存在，请运行 CLEAN=1 ./start.sh 或 ./fix-and-start.sh"
fi

if command -v lsof &>/dev/null; then
  PORT_INFO=$(lsof -i :3000 2>/dev/null | tail -n +2 || true)
  if [ -n "$PORT_INFO" ]; then
    ok "3000 端口有进程监听"
    echo "$PORT_INFO" | sed 's/^/    /'
  else
    fail "3000 端口无服务 — 请运行 ./start.sh"
  fi
fi

if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
  ok "HTTP 健康检查通过"
  curl -s "http://127.0.0.1:3000/api/health"
  echo ""
else
  fail "http://localhost:3000 无响应"
  echo "    尝试: bash fix-and-start.sh"
fi

if curl -fsS "http://127.0.0.1:3000/api/setup/ping" >/dev/null 2>&1; then
  echo ""
  echo "--- Supabase 连通性 ---"
  PING=$(curl -s "http://127.0.0.1:3000/api/setup/ping")
  echo "$PING" | python3 -m json.tool 2>/dev/null || echo "$PING"
else
  echo ""
  fail "无法访问 /api/setup/ping（服务未启动或未配置 Supabase）"
fi

if [ -f ".env.local" ]; then
  echo ""
  echo "--- .env.local ---"
  grep -E '^(NEXT_PUBLIC_SUPABASE_URL|HTTPS_PROXY|HTTP_PROXY)=' .env.local 2>/dev/null | sed 's/\(anon\|key\)=.*/\1=***/' || echo "（无 Supabase/代理配置）"
fi

echo ""
echo "=== 浏览器仍打不开？==="
echo "1. 确认终端里 npm start 在运行且无报错"
echo "2. 浏览器访问 http://localhost:3000 （不是 https）"
echo "3. Cmd+Shift+R 强制刷新"
echo "4. 若一直转圈：打开开发者工具 Console，看是否有红色报错"
echo "5. 强制云端登录（清除本机缓存）: 浏览器 Console 执行:"
echo '   localStorage.removeItem("job-agent-offline");localStorage.removeItem("job-agent-offline-explicit");localStorage.removeItem("job-agent-data");localStorage.setItem("job-agent-cloud-mode","1");location.href="/login"'
echo ""

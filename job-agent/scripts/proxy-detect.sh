# shellcheck shell=bash
# 供 fix-and-start.sh / start.sh source：为本机 Next.js 注入 Clash 代理
detect_local_proxy() {
  if [ -n "$HTTPS_PROXY" ] || [ -n "$HTTP_PROXY" ]; then
    echo "   代理: ${HTTPS_PROXY:-$HTTP_PROXY}"
    return 0
  fi

  if [ -f .env.local ]; then
    local env_proxy
    env_proxy=$(grep -E '^(HTTPS_PROXY|HTTP_PROXY)=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$env_proxy" ]; then
      export HTTPS_PROXY="$env_proxy"
      export HTTP_PROXY="$env_proxy"
      echo "   已从 .env.local 加载代理: ${HTTPS_PROXY}"
      return 0
    fi
  fi

  for port in 7890 7897 1087 1080 8118; do
    if command -v lsof &>/dev/null && lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      export HTTPS_PROXY="http://127.0.0.1:${port}"
      export HTTP_PROXY="http://127.0.0.1:${port}"
      echo "   检测到 Clash/代理端口 ${port}，已设置 HTTPS_PROXY=${HTTPS_PROXY}"
      return 0
    fi
  done

  echo "   ⚠️  未检测到代理。Clash 用户请在 .env.local 添加："
  echo "   HTTPS_PROXY=http://127.0.0.1:7890"
  return 1
}

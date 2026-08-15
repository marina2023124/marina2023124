#!/usr/bin/env bash
# JobAgent 离职扫描：只读列出需要备份 / 清理 / 不要带走的材料。
# 不会打印密钥内容。默认不删除任何文件。
#
# 用法：
#   bash scan-leave.sh
#   bash scan-leave.sh --clean-job-agent   # 仅删除已找到的 JobAgent .env.local / .env.local.bak

set -u

CLEAN_JOB_AGENT=0
if [ "${1:-}" = "--clean-job-agent" ]; then
  CLEAN_JOB_AGENT=1
fi

ok() { printf '  [备份] %s\n' "$1"; }
clean() { printf '  [清理] %s\n' "$1"; }
leave() { printf '  [勿带] %s\n' "$1"; }
info() { printf '  [信息] %s\n' "$1"; }

file_size() {
  local path="$1"
  if command -v stat >/dev/null 2>&1; then
    stat -f '%z' "$path" 2>/dev/null || stat -c '%s' "$path" 2>/dev/null || echo "?"
  else
    echo "?"
  fi
}

HUMAN_HOME="${HOME:-}"
SEARCH_ROOTS=()

add_root() {
  local dir="$1"
  [ -n "$dir" ] || return 0
  [ -d "$dir" ] || return 0
  SEARCH_ROOTS+=("$dir")
}

add_root "$HUMAN_HOME"
add_root "$HUMAN_HOME/marina2023124"
add_root "$HUMAN_HOME/Downloads"
add_root "$HUMAN_HOME/Desktop"
add_root "$HUMAN_HOME/Documents"
add_root "$PWD"
add_root "$(cd "$(dirname "$0")" && pwd)"
add_root "/workspace"
add_root "/workspace/job-agent"

# 去重
UNIQUE_ROOTS=()
for dir in "${SEARCH_ROOTS[@]}"; do
  skip=0
  for existing in "${UNIQUE_ROOTS[@]+"${UNIQUE_ROOTS[@]}"}"; do
    if [ "$existing" = "$dir" ]; then
      skip=1
      break
    fi
  done
  if [ "$skip" -eq 0 ]; then
    UNIQUE_ROOTS+=("$dir")
  fi
done
SEARCH_ROOTS=("${UNIQUE_ROOTS[@]}")

echo "=== JobAgent 离职扫描（只读）==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date)"
echo "扫描目录:"
for dir in "${SEARCH_ROOTS[@]}"; do
  echo "  - $dir"
done
echo ""
echo "说明: [备份]=个人材料先拷走  [清理]=工作电脑删掉  [勿带]=公司材料不要拷到个人设备"
echo ""

FOUND_ENV=()
FOUND_BACKUP_JSON=()
FOUND_WEEKLY=()
FOUND_RESUME=()
FOUND_JOB_AGENT_DIR=()

scan_dir() {
  local root="$1"
  local maxdepth="${2:-5}"

  while IFS= read -r -d '' path; do
    case "$path" in
      */node_modules/*|*/.git/*|*/.next/*|*/.cache/*) continue ;;
    esac
    local base
    base="$(basename "$path")"
    case "$base" in
      .env.local|.env.local.bak|.env)
        FOUND_ENV+=("$path")
        ;;
      job-agent-backup-*.json|job-agent-personal-backup-*.json)
        FOUND_BACKUP_JSON+=("$path")
        ;;
    esac
    if echo "$base" | grep -Eq '周报|复盘|Weekly|WK[0-9]'; then
      FOUND_WEEKLY+=("$path")
    fi
    if echo "$base" | grep -Eqi '简历|resume|curriculum|cv[-_. ]'; then
      FOUND_RESUME+=("$path")
    fi
    if [ "$base" = "job-agent" ] && [ -d "$path" ]; then
      FOUND_JOB_AGENT_DIR+=("$path")
    fi
  done < <(find "$root" -maxdepth "$maxdepth" \( \
      -name '.env.local' -o -name '.env.local.bak' -o -name '.env' -o \
      -name 'job-agent-backup-*.json' -o -name 'job-agent-personal-backup-*.json' -o \
      -iname '*周报*' -o -iname '*复盘*' -o -iname '*weekly*' -o \
      -iname '*简历*' -o -iname '*resume*' -o \
      -name 'job-agent' \
    \) -print0 2>/dev/null)
}

for dir in "${SEARCH_ROOTS[@]}"; do
  scan_dir "$dir" 5
done

echo "--- 个人求职材料（先备份到手机/网盘）---"
if [ "${#FOUND_RESUME[@]}" -eq 0 ] && [ "${#FOUND_BACKUP_JSON[@]}" -eq 0 ]; then
  info "未在常见目录发现简历或 JobAgent 备份 JSON。请打开 JobAgent → 离职清理 → 下载个人求职备份。"
else
  for path in "${FOUND_RESUME[@]+"${FOUND_RESUME[@]}"}"; do
    ok "简历类文件  $path  ($(file_size "$path") bytes)  → 拷到个人设备后，工作电脑副本删除"
  done
  for path in "${FOUND_BACKUP_JSON[@]+"${FOUND_BACKUP_JSON[@]}"}"; do
    ok "JobAgent 备份  $path  ($(file_size "$path") bytes)  → 确认传到个人网盘后再删工作电脑副本"
  done
fi
echo ""

echo "--- 工作电脑必须清理（密钥/登录）---"
if [ "${#FOUND_JOB_AGENT_DIR[@]}" -gt 0 ]; then
  for path in "${FOUND_JOB_AGENT_DIR[@]}"; do
    clean "JobAgent 目录  $path  （代码可留在个人 GitHub；这台工作电脑上的副本归还前删除或按 IT 要求处理）"
  done
fi
if [ "${#FOUND_ENV[@]}" -eq 0 ]; then
  info "未发现 .env.local。若从未在这台电脑配置过云端密钥，可忽略。"
else
  for path in "${FOUND_ENV[@]}"; do
    clean "密钥文件  $path  ($(file_size "$path") bytes)  内容未显示。归还电脑前删除。"
  done
fi

if [ -f "$HUMAN_HOME/.gitconfig" ]; then
  GIT_EMAIL="$(git config --global --get user.email 2>/dev/null || true)"
  GIT_NAME="$(git config --global --get user.name 2>/dev/null || true)"
  clean "Git 用户  ${GIT_NAME:-?} <${GIT_EMAIL:-?}>  （工作电脑退出公司/个人 git 登录）"
fi

if [ -d "$HUMAN_HOME/.ssh" ]; then
  KEY_COUNT="$(find "$HUMAN_HOME/.ssh" -maxdepth 1 -type f ! -name '*.pub' ! -name 'known_hosts*' ! -name 'config' 2>/dev/null | wc -l | tr -d ' ')"
  clean "SSH 私钥目录  $HUMAN_HOME/.ssh  （约 ${KEY_COUNT} 个私钥文件名，未读取内容。公司钥匙交还；个人钥匙不要留在归还设备）"
fi

for secret_file in \
  "$HUMAN_HOME/.npmrc" \
  "$HUMAN_HOME/.netrc" \
  "$HUMAN_HOME/.config/gh/hosts.yml" \
  "$HUMAN_HOME/.cursor/argv.json"
 do
  if [ -e "$secret_file" ]; then
    clean "可能含登录信息  $secret_file  （退出对应账号，不要拷到下一家公司）"
  fi
done
echo ""

echo "--- 不要带走（公司材料，仅列出文件名）---"
if [ "${#FOUND_WEEKLY[@]}" -eq 0 ]; then
  info "未在常见目录发现文件名含「周报/复盘」的文件。仍请检查企业网盘、邮箱、飞书。"
else
  for path in "${FOUND_WEEKLY[@]}"; do
    leave "$path  ($(file_size "$path") bytes)  不要拷到个人 U 盘/网盘"
  done
fi
echo ""

echo "--- 浏览器（需在网页里清）---"
info "打开 JobAgent → 离职清理 → 扫描这台浏览器 → 清除本机浏览器残留"
info "或在浏览器 Console 执行页面提供的清理片段"
echo ""

if [ "$CLEAN_JOB_AGENT" -eq 1 ]; then
  echo "--- 执行 --clean-job-agent ---"
  if [ "${#FOUND_ENV[@]}" -eq 0 ]; then
    info "没有可删除的 .env.local"
  else
    printf '即将删除 %s 个密钥文件。输入 YES 确认： ' "${#FOUND_ENV[@]}"
    read -r CONFIRM
    if [ "$CONFIRM" = "YES" ]; then
      for path in "${FOUND_ENV[@]}"; do
        rm -f "$path" && echo "  已删除 $path"
      done
    else
      info "已取消删除"
    fi
  fi
  echo ""
fi

echo "建议顺序："
echo "  1. 在个人设备打开 JobAgent，确认云端经历是最新的"
echo "  2. 下载「个人求职备份」到手机/网盘（不要留在工作电脑下载文件夹）"
echo "  3. 网页里清除浏览器残留并退出登录"
echo "  4. 删除工作电脑 .env.local、备份 JSON、JobAgent 本地目录"
echo "  5. 周报/内部文档按公司规定交还或销毁，不要带走"
echo "  6. 公司邮箱、SSO、VPN、代码仓库走 IT 离职流程"
echo ""
echo "扫描完成。"

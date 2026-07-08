#!/bin/bash
# 无法访问 GitHub 时，通过 jsDelivr CDN 拉取最新代码
# 用法：cd ~/marina2023124/job-agent && bash update-via-cdn.sh

set -e

# 用 commit 固定版本，避免 jsDelivr 分支缓存返回旧文件
COMMIT_SHA="5c29c3d73119"
EXPECTED_VERSION="0.2.4-experience-import"
BASE="https://cdn.jsdelivr.net/gh/marina2023124/marina2023124@${COMMIT_SHA}/job-agent"

echo "📥 通过 CDN 更新 JobAgent（无需访问 github.com）"
echo "   来源: cdn.jsdelivr.net"
echo "   版本: ${COMMIT_SHA} (${EXPECTED_VERSION})"
echo ""

if ! command -v curl &>/dev/null; then
  echo "❌ 需要 curl，macOS 一般自带"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 备份配置
if [ -f ".env.local" ]; then
  cp .env.local .env.local.bak
  echo "✓ 已备份 .env.local → .env.local.bak"
fi

download() {
  local rel="$1"
  local dir
  dir="$(dirname "$rel")"
  [ "$dir" != "." ] && mkdir -p "$dir"
  echo "  → $rel"
  if ! curl -fsSL "${BASE}/${rel}" -o "$rel"; then
    echo "❌ 下载失败: $rel"
    echo "   请检查网络，或换手机热点重试"
    exit 1
  fi
}

FILES=(
  "VERSION"
  "start.sh"
  "package.json"
  "package-lock.json"
  "src/lib/types.ts"
  "src/lib/commute.ts"
  "src/lib/jd-sections.ts"
  "src/lib/job-sections.ts"
  "src/lib/job-merge.ts"
  "src/lib/profile-merge.ts"
  "src/lib/resume-parser.ts"
  "src/lib/document-extract.ts"
  "src/lib/local-storage.ts"
  "src/lib/jd-parser.ts"
  "src/lib/boss-bookmarklet.ts"
  "src/lib/storage.ts"
  "src/lib/supabase/middleware.ts"
  "src/components/AuthGuard.tsx"
  "src/components/CommuteInfo.tsx"
  "src/components/JobDetailSections.tsx"
  "src/components/JobManager.tsx"
  "src/components/BossImportGuide.tsx"
  "src/components/SmartExperienceImport.tsx"
  "src/components/ExperienceManager.tsx"
  "src/app/experience/page.tsx"
  "src/app/api/commute/route.ts"
  "src/app/login/page.tsx"
)

echo "开始下载 ${#FILES[@]} 个文件..."
for f in "${FILES[@]}"; do
  download "$f"
done

if [ ! -f "VERSION" ] || [ "$(cat VERSION | tr -d '[:space:]')" != "$EXPECTED_VERSION" ]; then
  echo "❌ 版本校验失败：期望 ${EXPECTED_VERSION}，实际 $(cat VERSION 2>/dev/null || echo '无')"
  exit 1
fi

if ! grep -q "三版块" "src/components/JobManager.tsx"; then
  echo "❌ JobManager.tsx 不是最新版（缺少三版块 UI）"
  echo "   CDN 可能仍在缓存旧文件，请稍后重试或换网络"
  exit 1
fi

if ! grep -q "SmartExperienceImport" "src/components/ExperienceManager.tsx"; then
  echo "❌ ExperienceManager.tsx 不是最新版（缺少智能导入经历）"
  exit 1
fi

if [ -d ".next" ]; then
  echo "🧹 清理 Next 构建缓存（避免 layout.js 404）..."
  rm -rf .next
fi

echo ""
echo "✅ 更新完成！当前版本: $(cat VERSION)"
echo ""
echo "⚠️  必须重启服务才能生效："
echo "   1. 终端里按 Ctrl+C 停掉旧服务"
echo "   2. 运行: ./start.sh"
echo "   3. 浏览器强制刷新: Cmd+Shift+R"
echo "   4. 若仍转圈 → 点「离线使用」，或等待 2 秒自动进入离线模式"
echo "   5. 新依赖：运行 npm install（若 package.json 有更新）"
echo ""
echo "下一步："
echo "  1. ./start.sh          # 启动服务"
echo "  2. 浏览器打开 http://localhost:3000/jobs"
echo "  3. 若转圈 → 点「离线使用」"
echo "  4. 重新拖书签「📥 导入 BOSS 岗位」以获取薪资"
echo ""

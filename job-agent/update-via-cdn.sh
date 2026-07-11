#!/bin/bash
# 无法访问 GitHub 时，通过 jsDelivr CDN 拉取最新代码
# 用法：cd ~/marina2023124/job-agent && bash update-via-cdn.sh

set -e

COMMIT_SHA="543479c"
EXPECTED_VERSION="0.2.32-weekly-work-link"
BASE="https://cdn.jsdelivr.net/gh/marina2023124/marina2023124@${COMMIT_SHA}/job-agent"

echo "📥 通过 CDN 更新 JobAgent（无需访问 github.com）"
echo "   来源: cdn.jsdelivr.net"
echo "   版本: ${COMMIT_SHA} (${EXPECTED_VERSION})"
echo ""

if ! command -v curl &>/dev/null; then
  echo "❌ 需要 curl"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env.local" ]; then
  cp .env.local .env.local.bak
  echo "✓ 已备份 .env.local"
fi

download() {
  local rel="$1"
  local dir
  dir="$(dirname "$rel")"
  [ "$dir" != "." ] && mkdir -p "$dir"
  echo "  → $rel"
  if ! curl -fsSL "${BASE}/${rel}" -o "$rel"; then
    echo "❌ 下载失败: $rel"
    exit 1
  fi
}

FILES=(
  "VERSION"
  "start.sh"
  "update-via-cdn.sh"
  "package.json"
  "package-lock.json"
  "next.config.mjs"
  "tsconfig.json"
  "tailwind.config.ts"
  "postcss.config.mjs"
  "src/lib/types.ts"
  "src/lib/utils.ts"
  "src/lib/matching.ts"
  "src/lib/job-criteria.ts"
  "src/lib/skill-tags.ts"
  "src/lib/profile-merge.ts"
  "src/lib/project-work-link.ts"
  "src/lib/weekly-report-parser.ts"
  "src/lib/project-workbook-parser.ts"
  "src/lib/project-work-summary.ts"
  "src/lib/project-table-parser.ts"
  "src/lib/resume-parser.ts"
  "src/lib/document-extract.ts"
  "src/lib/local-storage.ts"
  "src/lib/storage.ts"
  "src/lib/jd-parser.ts"
  "src/lib/jd-sections.ts"
  "src/lib/job-merge.ts"
  "src/lib/job-sections.ts"
  "src/lib/commute.ts"
  "src/lib/agent.ts"
  "src/lib/context-manager.ts"
  "src/lib/ocr.ts"
  "src/lib/cloud-storage.ts"
  "src/lib/boss-bookmarklet.ts"
  "src/lib/supabase/client.ts"
  "src/lib/supabase/middleware.ts"
  "src/lib/supabase/server.ts"
  "src/context/AppContext.tsx"
  "src/middleware.ts"
  "src/components/ExperienceManager.tsx"
  "src/components/SmartExperienceImport.tsx"
  "src/components/AuthGuard.tsx"
  "src/components/JobManager.tsx"
  "src/components/JobDetailSections.tsx"
  "src/components/BossImportGuide.tsx"
  "src/components/MatchView.tsx"
  "src/components/CommuteInfo.tsx"
  "src/components/AgentChat.tsx"
  "src/components/Sidebar.tsx"
  "src/components/SetupWizard.tsx"
  "src/components/ClientProviders.tsx"
  "src/components/ui.tsx"
  "src/app/layout.tsx"
  "src/app/page.tsx"
  "src/app/experience/page.tsx"
  "src/app/jobs/page.tsx"
  "src/app/match/page.tsx"
  "src/app/agent/page.tsx"
  "src/app/login/page.tsx"
  "src/app/api/commute/route.ts"
  "src/app/api/setup/configure/route.ts"
  "src/app/api/setup/test/route.ts"
)

echo "开始下载 ${#FILES[@]} 个文件..."
for f in "${FILES[@]}"; do
  download "$f"
done

if [ ! -f "VERSION" ] || [ "$(cat VERSION | tr -d '[:space:]')" != "$EXPECTED_VERSION" ]; then
  echo "❌ 版本校验失败：期望 ${EXPECTED_VERSION}"
  exit 1
fi

if ! grep -q "weekly-report-parser" "src/components/SmartExperienceImport.tsx"; then
  echo "❌ SmartExperienceImport 不是最新版（缺少周报导入）"
  exit 1
fi

if [ -d ".next" ]; then
  echo "🧹 清理 Next 构建缓存..."
  rm -rf .next
fi

echo ""
echo "✅ 更新完成！当前版本: $(cat VERSION)"
echo ""
echo "⚠️  必须重启服务："
echo "   CLEAN=1 PROD=1 ./start.sh"
echo "   浏览器 Cmd+Shift+R 强制刷新"
echo ""

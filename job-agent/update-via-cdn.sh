#!/bin/bash
# 无法访问 GitHub 时，通过 jsDelivr CDN 拉取最新代码
# 用法：cd ~/marina2023124/job-agent && bash update-via-cdn.sh

set -e

COMMIT_SHA="b8aab5b"
EXPECTED_VERSION="0.2.33-offline-fix"
BASE="https://cdn.jsdelivr.net/gh/marina2023124/marina2023124@${COMMIT_SHA}/job-agent"

echo "📥 通过 CDN 更新 JobAgent"
echo "   版本: ${EXPECTED_VERSION} @ ${COMMIT_SHA}"
echo ""

if ! command -v curl &>/dev/null; then
  echo "❌ 需要 curl"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

[ -f ".env.local" ] && cp .env.local .env.local.bak && echo "✓ 已备份 .env.local"

download() {
  local rel="$1"
  mkdir -p "$(dirname "$rel")"
  echo "  → $rel"
  curl -fsSL "${BASE}/${rel}" -o "$rel" || { echo "❌ 下载失败: $rel"; exit 1; }
}

FILES=(
  "VERSION" "start.sh" "fix-and-start.sh" "doctor.sh" "update-via-cdn.sh"
  "package.json" "package-lock.json" "next.config.mjs" "tsconfig.json"
  "tailwind.config.ts" "postcss.config.mjs"
  "src/lib/types.ts" "src/lib/utils.ts" "src/lib/matching.ts" "src/lib/job-criteria.ts"
  "src/lib/skill-tags.ts" "src/lib/profile-merge.ts" "src/lib/project-work-link.ts"
  "src/lib/weekly-report-parser.ts" "src/lib/project-workbook-parser.ts"
  "src/lib/project-work-summary.ts" "src/lib/project-table-parser.ts"
  "src/lib/resume-parser.ts" "src/lib/document-extract.ts" "src/lib/local-storage.ts"
  "src/lib/storage.ts" "src/lib/jd-parser.ts" "src/lib/jd-sections.ts"
  "src/lib/job-merge.ts" "src/lib/job-sections.ts" "src/lib/commute.ts"
  "src/lib/agent.ts" "src/lib/context-manager.ts" "src/lib/ocr.ts"
  "src/lib/cloud-storage.ts" "src/lib/boss-bookmarklet.ts"
  "src/lib/supabase/client.ts" "src/lib/supabase/middleware.ts" "src/lib/supabase/server.ts"
  "src/context/AppContext.tsx" "src/middleware.ts"
  "src/components/ExperienceManager.tsx" "src/components/SmartExperienceImport.tsx"
  "src/components/AuthGuard.tsx" "src/components/JobManager.tsx"
  "src/components/JobDetailSections.tsx" "src/components/BossImportGuide.tsx"
  "src/components/MatchView.tsx" "src/components/CommuteInfo.tsx"
  "src/components/AgentChat.tsx" "src/components/Sidebar.tsx"
  "src/components/SetupWizard.tsx" "src/components/ClientProviders.tsx"
  "src/components/ui.tsx"
  "src/app/layout.tsx" "src/app/page.tsx" "src/app/experience/page.tsx"
  "src/app/jobs/page.tsx" "src/app/match/page.tsx" "src/app/agent/page.tsx"
  "src/app/login/page.tsx" "src/app/api/health/route.ts"
  "src/app/api/commute/route.ts" "src/app/api/setup/configure/route.ts"
  "src/app/api/setup/test/route.ts"
)

for f in "${FILES[@]}"; do download "$f"; done

if [ "$(cat VERSION | tr -d '[:space:]')" != "$EXPECTED_VERSION" ]; then
  echo "❌ 版本校验失败"
  exit 1
fi

rm -rf .next
echo ""
echo "✅ 更新完成: $(cat VERSION)"
echo ""
echo "下一步（必须执行）："
echo "  chmod +x fix-and-start.sh doctor.sh start.sh"
echo "  ./fix-and-start.sh"
echo ""
echo "若浏览器仍转圈，在 Console 执行："
echo '  localStorage.removeItem("job-agent-cloud-mode");localStorage.setItem("job-agent-offline","1");location.reload()'
echo ""

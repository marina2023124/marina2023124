#!/bin/bash
# 无法访问 GitHub 时，通过 jsDelivr CDN 拉取最新代码
# 用法：cd ~/marina2023124/job-agent && bash update-via-cdn.sh

set -e

# 使用分支名，避免 commit SHA 过期或写错（如 REPLACE_SHA）
GIT_REF="cursor/job-finding-agent-5260"
EXPECTED_VERSION="0.2.47-weekly-canonical-merge"
BASE="https://cdn.jsdelivr.net/gh/marina2023124/marina2023124@${GIT_REF}/job-agent"

echo "📥 通过 CDN 更新 JobAgent"
echo "   分支: ${GIT_REF}"
echo "   期望版本: ${EXPECTED_VERSION}"
echo ""

if ! command -v curl &>/dev/null; then
  echo "❌ 需要 curl"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
chmod +x start.sh fix-and-start.sh doctor.sh go.sh 2>/dev/null || true

[ -f ".env.local" ] && cp .env.local .env.local.bak && echo "✓ 已备份 .env.local"

download() {
  local rel="$1"
  mkdir -p "$(dirname "$rel")"
  echo "  → $rel"
  if ! curl -fsSL "${BASE}/${rel}" -o "$rel"; then
    echo "❌ 下载失败: $rel"
    echo "   URL: ${BASE}/${rel}"
    echo "   请检查网络，或稍后重试"
    exit 1
  fi
}

FILES=(
  "VERSION" "start.sh" "fix-and-start.sh" "doctor.sh" "go.sh" "update-via-cdn.sh"
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

echo "开始下载 ${#FILES[@]} 个文件..."
for f in "${FILES[@]}"; do
  download "$f"
done

ACTUAL_VERSION="$(cat VERSION | tr -d '[:space:]')"
if [ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "⚠️  版本为 ${ACTUAL_VERSION}（期望 ${EXPECTED_VERSION}），继续安装..."
fi

if ! grep -q "fix-and-start.sh" "update-via-cdn.sh" 2>/dev/null; then
  echo "❌ update-via-cdn.sh 校验失败"
  exit 1
fi

rm -rf .next
chmod +x start.sh fix-and-start.sh doctor.sh go.sh 2>/dev/null || true

echo ""
echo "✅ 更新完成: ${ACTUAL_VERSION}"
echo ""
echo "下一步："
echo "  bash fix-and-start.sh"
echo "  或：bash go.sh"
echo ""
echo "若云端连接慢，请开 VPN 后刷新；或访问 /login"
echo "强制切云端（清除本机缓存），Console 执行："
echo '  localStorage.removeItem("job-agent-offline");localStorage.removeItem("job-agent-offline-explicit");localStorage.removeItem("job-agent-data");localStorage.setItem("job-agent-cloud-mode","1");location.href="/login"'
echo ""

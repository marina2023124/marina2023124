#!/bin/bash
# 打包 JobAgent 源码为 ZIP，便于迁移到其他环境
# 用法：cd job-agent && bash scripts/pack-release.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

VERSION="$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "unknown")"
NAME="JobAgent-${VERSION}"
OUT_DIR="${SCRIPT_DIR}/dist"
ZIP_PATH="${OUT_DIR}/${NAME}.zip"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH"

echo "📦 打包 ${NAME} ..."

zip -r "$ZIP_PATH" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x ".env.local" \
  -x ".env.local.bak" \
  -x ".last-build-version" \
  -x "*.zip" \
  -x ".DS_Store" \
  -x "**/.DS_Store"

BYTES=$(wc -c < "$ZIP_PATH" | tr -d ' ')
MB=$(awk "BEGIN {printf \"%.2f\", $BYTES/1024/1024}")

echo ""
echo "✅ 已生成: ${ZIP_PATH}"
echo "   大小: ${MB} MB"
echo ""
echo "迁移步骤:"
echo "  1. 将 ZIP 复制到新环境"
echo "  2. unzip ${NAME}.zip -d ~/job-agent && cd ~/job-agent"
echo "  3. npm install && ./start.sh"
echo "  4. 详见 MIGRATION.md"

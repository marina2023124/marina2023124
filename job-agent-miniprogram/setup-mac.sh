#!/bin/bash
# JobAgent 微信小程序 — Mac 一键安装脚本
# 用法：在终端粘贴运行（会把路径改成你的 【Job hunter】 目录）

set -e

# ========== 改成你 Finder 里 【Job hunter】 的完整路径 ==========
# 在 Finder 里选中 【Job hunter】 文件夹，按 Option+右键 → 「拷贝 ...」为路径名称」
TARGET_BASE="${1:-$HOME/【Kanyun】/【入职培训】/【Job hunter】}"

echo "目标目录: $TARGET_BASE"

if [ ! -d "$TARGET_BASE" ]; then
  echo "❌ 目录不存在，请修改脚本里的 TARGET_BASE 或在运行时传入路径："
  echo "   bash setup-mac.sh \"/你的路径/【Job hunter】\""
  exit 1
fi

# 目录结构
JOBAGENT="$TARGET_BASE/JobAgent"
MINIPROGRAM="$JOBAGENT/miniprogram"
BACKUP="$JOBAGENT/backup"
TMP="/tmp/jobagent-clone-$$"

mkdir -p "$MINIPROGRAM" "$BACKUP"

# 把现有备份 json 挪到 backup（如果还在根目录）
mv "$TARGET_BASE"/job-agent-backup*.json "$BACKUP/" 2>/dev/null || true

# 旧的 project.config 若在项目根目录，备份后移除（不完整的小程序配置）
if [ -f "$TARGET_BASE/project.config.json" ] && [ ! -f "$TARGET_BASE/app.json" ]; then
  mv "$TARGET_BASE/project.config.json" "$BACKUP/project.config.old.json" 2>/dev/null || true
  mv "$TARGET_BASE/project.private.config.json" "$BACKUP/project.private.config.old.json" 2>/dev/null || true
  echo "✓ 已备份旧的 project.config 到 JobAgent/backup/"
fi

echo "正在从 GitHub 下载小程序代码..."
git clone --depth 1 --branch cursor/wechat-miniprogram-5260 --single-branch \
  https://github.com/marina2023124/marina2023124.git "$TMP"

cp -R "$TMP/job-agent-miniprogram/." "$MINIPROGRAM/"
rm -rf "$TMP"

# 迁移清单
cat > "$JOBAGENT/迁移清单.txt" << 'EOF'
【JobAgent 个人项目 — 离职迁移用】

📁 目录说明
  JobAgent/miniprogram/   ← 微信开发者工具导入这个文件夹
  JobAgent/backup/        ← 数据备份 json

🔧 微信开发者工具
  1. 项目 → 导入项目
  2. 目录选：.../【Job hunter】/JobAgent/miniprogram
  3. AppID 填你的小程序 AppID
  4. 详情 → 本地设置 → 勾选「不校验合法域名」

🌐 线上地址
  Web:  https://marina2023124.vercel.app/try
  API:  https://marina2023124.vercel.app

🔑 密钥（存在网页，不在本机）
  - 微信小程序 AppSecret → mp.weixin.qq.com
  - Vercel 环境变量 → vercel.com
  - Supabase → supabase.com

📦 离职带走：整个 JobAgent 文件夹 + GitHub 账号
EOF

echo ""
echo "✅ 安装完成！"
echo ""
echo "小程序代码在："
echo "  $MINIPROGRAM"
echo ""
echo "下一步："
echo "  1. 打开微信开发者工具"
echo "  2. 导入项目 → 目录选上面的 miniprogram 文件夹"
echo "  3. 填入你的 AppID → 编译"
echo ""

# 在 Finder 中打开
open "$JOBAGENT" 2>/dev/null || true

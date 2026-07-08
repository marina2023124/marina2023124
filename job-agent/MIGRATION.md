# JobAgent 迁移指南

本压缩包为 **JobAgent 0.2.3** 完整源码，可在新环境离线部署。

## 包内包含

- 完整 Next.js 源码（含 JD 三版块解析、BOSS 书签导入、通勤估算、离线模式）
- `start.sh` 一键启动脚本
- `supabase/schema.sql` 云端数据库结构
- `.env.local.example` 环境变量模板

## 不包含（需在新环境生成）

- `node_modules/` — 运行 `npm install` 安装
- `.next/` — 运行 `./start.sh` 时自动生成
- `.env.local` — 含密钥，请自行配置

## 新环境部署步骤

### 1. 解压

```bash
unzip JobAgent-0.2.3-jd-sections.zip -d ~/job-agent
cd ~/job-agent
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动（推荐）

```bash
chmod +x start.sh
./start.sh
```

浏览器打开 http://localhost:3000

### 4. 使用模式

**离线模式（国内推荐，无需 Supabase）**

- 打开页面后若转圈，点「离线使用」或等待约 2 秒自动进入
- 数据保存在本次浏览器会话，关闭浏览器后清除

**云端模式（需能访问 supabase.co）**

```bash
cp .env.local.example .env.local
# 编辑 .env.local 填入 Supabase URL 和 anon key
```

在 Supabase SQL Editor 执行 `supabase/schema.sql`，然后重启 `./start.sh`

### 5. BOSS 直聘导入薪资

1. 进入「岗位管理」→ 查看 BOSS 导入说明
2. 将书签拖入浏览器收藏栏
3. 在 BOSS 岗位详情页点击书签，粘贴到 JobAgent 并「智能识别」

## 从旧环境迁移数据

在旧环境侧边栏点击 **下载备份**，得到 JSON 文件。

在新环境进入离线模式或登录云端后，使用 **从文件恢复** 导入该 JSON。

## 常见问题

| 问题 | 处理 |
|------|------|
| 页面一直转圈 | 点「离线使用」，或 `CLEAN=1 ./start.sh` 后强制刷新浏览器 |
| layout.js 404 | 删除 `.next` 后重新 `./start.sh` |
| 看不到三版块 | 确认页面显示「版本 0.2.3」 |
| 端口被占用 | 换终端先 `Ctrl+C` 停掉旧进程 |

## 版本信息

- 版本：`0.2.3-jd-sections`
- 功能：职位描述 / 岗位职责 / 任职要求 同义词识别与分版块展示

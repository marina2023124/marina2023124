# JobAgent - 智能求职助手

一个帮助你梳理工作经历、管理岗位 JD、智能匹配理想职位的 Web 应用。**所有数据保存在 Supabase 云端，不会写入浏览器本地。**

## 功能

- **我的经历** — 录入基本信息、工作经历（STAR 法则）、技能、项目和教育背景
- **岗位管理** — 添加 JD，自动提取技能关键词，跟踪投递状态
- **智能匹配** — 基于技能重叠度和经验年限计算匹配分数，给出投递建议
- **职业顾问 Agent** — 对话式助手，帮你梳理经历、分析技能、生成简历摘要、准备面试
- **云端存储** — 登录后数据自动同步到 Supabase，换设备也能访问，工作电脑不留本地记录

## 快速开始

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com) 注册并创建免费项目
2. 在 **SQL Editor** 中执行 [`supabase/schema.sql`](supabase/schema.sql) 创建数据表
3. 在 **Project Settings → API** 复制 `Project URL` 和 `anon public` key

### 2. 配置环境变量

```bash
cd job-agent
cp .env.local.example .env.local
# 编辑 .env.local，填入 Supabase URL 和 anon key
```

### 3. 启动应用

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，注册账号后即可使用。

## 数据存储说明

| 存储位置 | 内容 | 说明 |
|---------|------|------|
| **Supabase 云端** | 工作经历、岗位、对话记录 | 主要存储，自动同步 |
| 浏览器 Cookie | 登录会话令牌 | 仅用于保持登录状态 |
| 浏览器内存 | 当前页面数据 | 关闭标签页后清除 |

**不会使用 localStorage 保存求职资料。** 退出登录后，工作电脑上不会残留你的简历和岗位数据。

侧边栏的「下载备份」仅在您主动点击时才会生成 JSON 文件到本地。

## 技术栈

- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- Supabase（Auth + PostgreSQL 云端存储）

## 使用流程

1. 注册/登录账号
2. 在「我的经历」中填写个人信息和工作经历
3. 在「岗位管理」中添加感兴趣的 JD
4. 在「智能匹配」中查看各岗位的匹配度和建议
5. 在「职业顾问」中与 Agent 对话，获取个性化求职建议

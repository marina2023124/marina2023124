# JobAgent 微信小程序

原生微信小程序 MVP，对接 JobAgent 后端 API。

## 功能（MVP）

- 微信一键登录（openid）
- 首页：档案完整度、最佳匹配
- 经历：基本信息、技能、工作经历
- 岗位：粘贴 JD 自动解析
- 匹配：规则引擎匹配度分析
- 数据云端同步（Supabase `wechat_user_data` 表）

## 开发步骤

### 1. 注册微信小程序

1. 打开 [微信公众平台](https://mp.weixin.qq.com/) → 小程序 → 注册
2. 记下 **AppID** 和 **AppSecret**
3. 在「开发 → 开发管理 → 开发设置」配置服务器域名：
   - request 合法域名：`https://marina2023124.vercel.app`（或你的自定义域名）

### 2. 配置后端环境变量（Vercel）

在 Vercel 项目 Settings → Environment Variables 添加：

| 变量 | 说明 |
|------|------|
| `WECHAT_APPID` | 小程序 AppID |
| `WECHAT_SECRET` | 小程序 AppSecret |
| `WECHAT_JWT_SECRET` | 任意随机字符串（用于签发登录 token） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（服务端读写） |

并在 Supabase SQL Editor 执行：

```sql
-- 见 ../job-agent/supabase/wechat-schema.sql
```

### 3. 用微信开发者工具打开

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本项目目录 `job-agent-miniprogram/`
3. 填入你的 AppID（测试可用测试号）
4. 详情 → 本地设置 → 勾选「不校验合法域名」（仅开发阶段）
5. 修改 `utils/api.js` 中的 `API_BASE` 为你的后端地址

### 4. 预览与发布

- 开发者工具 → 预览 → 手机扫码体验
- 确认无误后 → 上传 → 在微信公众平台提交审核

## 目录结构

```
job-agent-miniprogram/
├── app.js / app.json / app.wxss   # 小程序入口
├── custom-tab-bar/                # 底部 Tab（小程序风格）
├── pages/
│   ├── index/                     # 首页
│   ├── experience/                # 我的经历
│   ├── jobs/                      # 岗位列表
│   ├── job-add/                   # 粘贴 JD
│   └── match/                     # 智能匹配
└── utils/
    ├── api.js                     # 后端 API 封装
    └── storage.js                 # 本地缓存
```

## 后续可扩展

- [ ] AI 职业顾问（对接 `/api/llm/chat`）
- [ ] 猎聘/小红书链接导入（对接 `/api/jobs/import-url`）
- [ ] 简历图片 OCR
- [ ] 分享卡片、订阅消息

## 与 Web 版的关系

| | Web 版 | 小程序 |
|--|--------|--------|
| 登录 | 邮箱 + Supabase | 微信 openid |
| 数据存储 | `user_app_data` | `wechat_user_data` |
| 匹配引擎 | 同一套 `matching.ts` | 通过 `/api/match` 调用 |
| 访客模式 | `/try` | 首次启动可选示例数据 |

Web 版与小程序数据**不互通**（不同账号体系），后续可做绑定功能。

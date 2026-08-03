# JobAgent 微信小程序

原生微信小程序 MVP，对接 JobAgent 后端 API。

## 推荐：云端 CI 上传，手机扫码体验（工作电脑不留痕）

无需在本机安装微信开发者工具。代码 push 到 GitHub 后，Actions 自动编译并生成预览二维码。

### 一次性配置（约 10 分钟）

#### 1. 填写 AppID

编辑 `project.config.json`，把 `appid` 改成你的小程序 AppID：

```json
"appid": "wx你的AppID"
```

提交并 push 到 GitHub。

#### 2. 下载「代码上传密钥」

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. **开发 → 开发管理 → 开发设置 → 小程序代码上传**
3. 点击 **生成** 或 **重置**，下载 `.key` 文件（只显示一次，妥善保存）

#### 3. 关闭 IP 白名单（GitHub Actions 必做）

仍在 **开发设置 → 小程序代码上传** 页面：

- 若已开启 **IP 白名单**，请**关闭**（GitHub Actions 出口 IP 每次不同，无法固定加入白名单）
- 私钥 `WECHAT_UPLOAD_KEY` 仍是主要凭证，请妥善保管

#### 4. 配置 GitHub Secrets

打开 GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名称 | 内容 |
|-------------|------|
| `WECHAT_UPLOAD_KEY` | 打开 `.key` 文件，**全文复制**（含 `-----BEGIN RSA PRIVATE KEY-----` 行） |

#### 5. 配置服务器域名（正式发布前）

小程序后台 → **开发设置 → 服务器域名 → request 合法域名**：

```
https://marina2023124.vercel.app
```

开发阶段若 CI 预览报域名错误，需先在后台添加域名；预览版有时可跳过，以实际为准。

### 日常使用（零本机留痕）

```
1. 在 Cursor Cloud / GitHub 改 job-agent-miniprogram/ 代码
2. git push
3. 打开 GitHub → Actions →「微信小程序 CI」→ 最新一条
4. 右侧 Artifacts → 下载 miniprogram-preview-qrcode
5. 手机微信扫 png 二维码 → 打开预览
```

**推送到 main 分支**时，还会自动上传**体验版**，可在小程序后台 → **版本管理 → 体验版** 扫码（比每次下 Artifacts 更方便）。

手动触发：Actions → 微信小程序 CI → **Run workflow**。

---

## 功能（MVP）

- 微信一键登录（openid）
- 首页：档案完整度、最佳匹配
- 经历：基本信息、技能、工作经历
- **智能添加岗位**：粘贴 JD 或导入猎聘/小红书链接，预览后保存
- 匹配：规则引擎 + **DeepSeek 深度分析**
- **AI 职业顾问**：DeepSeek 对话（`/pages/agent`）
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
| `DEEPSEEK_API_KEY` | DeepSeek API Key（AI 顾问与深度匹配） |

并在 Supabase SQL Editor 执行：

```sql
-- 见 ../job-agent/supabase/wechat-schema.sql
-- 若报 permission denied，执行 miniprogram-permissions-fix.sql（一次性修复全部）
```

### 3. 本地开发（可选）

若需在本机调试，才需要微信开发者工具：

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

- [x] AI 职业顾问（对接 `/api/llm/chat`）
- [x] 猎聘/小红书链接导入（对接 `/api/jobs/import-url`）
- [ ] 简历图片 OCR
- [ ] 分享卡片、订阅消息

## 与 Web 版的关系

| | Web 版 | 小程序 |
|--|--------|--------|
| 登录 | 邮箱 + Supabase | 微信 openid |
| 数据存储 | `user_app_data` | 绑定前 `wechat_user_data`，绑定后统一 `user_app_data` |
| 账号绑定 | 侧边栏 → 生成 6 位绑定码 | 首页 → 绑定网页账号 |
| 匹配引擎 | 同一套 `matching.ts` | 通过 `/api/match` 调用 |
| 访客模式 | `/try` | 首次启动可选示例数据 |

绑定后 Web 与小程序**数据实时同步**。首次绑定会自动合并两边的经历与岗位。

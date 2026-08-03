# JobAgent 交接文档

> 最后更新：**v0.2.37-cloud-only-default**（分支 `cursor/job-finding-agent-5260`）。Vercel 生产部署需跟踪此分支并 Redeploy。

---

## 1. 我们在做什么

**JobAgent** 是一个面向求职者的 Next.js Web 应用，帮助用户：

1. 录入并管理**工作经历 / 项目 / 教育背景**
2. 管理岗位 JD，做**智能匹配**（技能、经验年限、专业等）
3. 使用**职业顾问 Agent** 对话
4. 将数据保存在 **Supabase 云端**（用户明确偏好：**工作电脑不留本地材料**）

### 用户背景（影响匹配逻辑）

- 约 **1–3 年用户研究（用研）** 经验
- 专业：**传播学**（应被识别为相关专业，不应显示「专业待补充」）
- 使用环境：**Mac 工作电脑**，本地路径约为 `~/marina2023124/job-agent`
- 网络：**可能无法稳定访问 GitHub**，依赖 **jsDelivr CDN** 更新代码
- 访问 **supabase.co 通常需要 VPN**（国内网络）

### 仓库与协作信息

| 项 | 值 |
|---|---|
| GitHub 仓库 | `marina2023124/marina2023124` |
| 应用目录 | `job-agent/`（monorepo 子目录） |
| 工作分支 | `cursor/job-finding-agent-5260` |
| PR | https://github.com/marina2023124/marina2023124/pull/2 |
| 当前版本 | `0.2.37-cloud-only-default`（见 `VERSION` 文件） |
| 技术栈 | Next.js 14 App Router、TypeScript、Tailwind、Supabase Auth + PostgreSQL |

---

## 2. 已经完成了什么

按版本/主题归纳（从新到旧）：

### v0.2.37 — 默认云端登录（用户最新诉求）

- **默认走云端**，不再自动切离线、不再自动把资料写入 `localStorage`
- 新增 `job-agent-offline-explicit`：只有用户**主动点击**「临时离线」才算离线
- `layout.tsx` 内联脚本：非明确离线用户 → 设 `job-agent-cloud-mode=1`，清除本机 `job-agent-data`
- 登录成功 / 退出 / 切云端时调用 `clearLocalAppData()`
- 云端连接超时（5s）**不再**自动 fallback 离线，改为提示 VPN 后重试
- 登录页文案强调「数据在云端，不推荐工作电脑离线」

### v0.2.36 — 启动脚本权限 + 云端切换修复

- `fix-and-start.sh` / `go.sh` 支持 `bash xxx.sh`，**无需 chmod**
- `AuthGuard`：`/login` 始终放行（修复离线模式下无法进登录页）
- `enterCloudMode()` 清除离线 cookie 并跳转 `/login`
- `update-via-cdn.sh` 下载后自动 `chmod +x`

### v0.2.35 — 传播学专业识别

- `findMatchingEducationLabel()`：从 `field`、`degree`、`summary` 等多字段识别「传播学」
- 不再仅依赖教育背景里单一的「专业」输入框

### v0.2.33–0.2.34 — 页面打不开 / 一直加载（曾做过离线优先，后在 v0.2.37 改回云端优先）

- 新增 `fix-and-start.sh`、`doctor.sh`、`go.sh`、`/api/health`
- 修复 CDN 脚本使用错误 commit SHA（`REPLACE_SHA`）导致 404
- `AuthGuard` 加载屏增加「离线使用」逃生按钮（v0.2.37 后降为备用）

### v0.2.32 — 周报导入 + 项目归属工作

- `src/lib/weekly-report-parser.ts`：解析周报文本
- `src/lib/project-work-link.ts`：按时间把项目关联到 `workExperienceId`
- `Project` 类型新增 `workExperienceId`
- `SmartExperienceImport.tsx` 增加「周报/工作记录」导入模式
- `ExperienceManager.tsx` 展示「所属工作」「期间项目」

### v0.2.31 — 岗位匹配逻辑优化

- 新增 `src/lib/job-criteria.ts`：结构化解析 JD「任职要求」，过滤「岗位职责」噪声
- 重写 `src/lib/matching.ts`：经验/学历/技能语义匹配
- 传播学纳入 `RELATED_MAJOR_EXPANSION`
- 修复 `calcUserResearchYears` 字段名 bug（`start` → `startDate`）
- 测试脚本：`scripts/verify-matching.ts`

### 更早

- 启动前释放 3000 端口、项目工作总结、页面崩溃修复等

---

## 3. 当前卡在哪

**代码侧**：v0.2.37 已 commit 并 push 到 `cursor/job-finding-agent-5260`，`npm run build` 通过。

**用户侧（待确认）**：

1. **用户 Mac 是否已用 CDN 更新到 v0.2.37** — 若仍跑旧版，会继续遇到离线默认、Permission denied 等问题
2. **云端登录是否成功** — 依赖 VPN + 正确配置的 `.env.local`（Supabase URL / anon key）
3. **无用户反馈** 确认 v0.2.37 在实际工作电脑上是否已能正常登录并使用

### 若用户仍报「加载不出来」

常见原因（按概率）：

| 现象 | 可能原因 |
|------|----------|
| `./fix-and-start.sh: Permission denied` | 应用 `bash fix-and-start.sh`，不要 `./` |
| 一直转圈 | 无 VPN，连不上 Supabase；或服务未启动（3000 端口） |
| 进不了登录页 | 旧版离线逻辑拦截；需更新到 v0.2.36+ |
| CDN 更新失败 | jsDelivr 缓存延迟；分支名写错；网络问题 |

---

## 4. 下一步计划

### 对用户（优先）

1. 让用户执行 CDN 更新 + 启动：

```bash
cd ~/marina2023124/job-agent

curl -fsSL "https://cdn.jsdelivr.net/gh/marina2023124/marina2023124@cursor/job-finding-agent-5260/job-agent/update-via-cdn.sh" -o update-via-cdn.sh

bash update-via-cdn.sh

bash fix-and-start.sh
# 或：bash go.sh
```

2. 开 **VPN**，访问 http://localhost:3000/login 登录
3. 若仍异常：`bash doctor.sh`，把完整输出要回来
4. 若被旧离线状态卡住，浏览器 Console：

```js
localStorage.removeItem("job-agent-offline");
localStorage.removeItem("job-agent-offline-explicit");
localStorage.removeItem("job-agent-data");
localStorage.setItem("job-agent-cloud-mode","1");
location.href="/login"
```

### 对开发（若用户确认仍有问题）

1. **验证云端链路**：`.env.local` 是否有效、`/login` 能否完成 signIn、数据是否写入 Supabase
2. **匹配准确度**：让用户提供具体 JD + 个人资料截图，对照 `scripts/verify-matching.ts` 调试
3. **README 与 HANDOFF 对齐**：README 写「不用 localStorage」，但离线备用路径仍会写 `job-agent-data` — 文档可注明「仅紧急离线时」
4. **PR #2**：功能稳定后可考虑 merge 到 `main`，并更新 CDN 默认分支策略
5. **可选增强**：
   - 登录页显示 Supabase 连接检测状态
   - 云端模式下完全隐藏「临时离线」入口（若用户坚持零本地）
   - 合并后让 `update-via-cdn.sh` 的 `GIT_REF` 指向 `main`

---

## 5. 踩过的坑 — 绝对不要再踩

### CDN / 更新

1. **`update-via-cdn.sh` 不要用 commit SHA 或 `REPLACE_SHA` 占位符**  
   曾导致 jsDelivr 404。必须用**分支名**：`cursor/job-finding-agent-5260`。

2. **CDN 有缓存延迟**  
   刚 push 后用户立刻 `update-via-cdn.sh` 可能拉到旧文件。可对比本地 `VERSION` 是否为 `0.2.37-cloud-only-default`。

3. **`update-via-cdn.sh` 的 `FILES` 列表必须完整**  
   漏文件会导致用户半新半旧、构建失败或行为诡异。改架构时记得同步更新该列表。

4. **`EXPECTED_VERSION` 要与 `VERSION` 同步**  
   否则用户看到误导性警告（脚本会继续，但增加困惑）。

### 启动脚本

5. **`./fix-and-start.sh` 会 Permission denied**  
   CDN 下载的文件常无 `+x`。始终告诉用户用 `bash fix-and-start.sh`；脚本内提示也要写 `bash`，不要写 `./`。

6. **3000 端口占用**  
   旧 `npm start` 未退出会导致新服务起不来。`fix-and-start.sh` 已含 `free_port`，但用户可能直接 `npm start`。

### 离线 / 云端模式（最易反复出 bug）

7. **不要默认强制离线**（v0.2.34 做过，用户明确反对）  
   用户要云端-only、工作电脑不留资料。默认应 `job-agent-cloud-mode=1`。

8. **不要用 `job-agent-offline=1` 作为「未选择」的默认**  
   `layout.tsx` 内联脚本会在 React  hydrate 前执行；这里写错会导致全站离线。

9. **AuthGuard 必须放行 `/login`**  
   否则离线用户点「切云端」会被 redirect 回 `/`，永远进不了登录页。

10. **连接 Supabase 超时后不要自动 `enableLocalMode()`**  
    这会把用户 silently 切到离线并在本机写数据，违背工作电脑诉求。

11. **区分「自动离线」与「用户主动离线」**  
    使用 `job-agent-offline-explicit`。迁移时：无 explicit 标记的旧 `offline=1` 应被 `ensureCloudDefault()` 清掉。

12. **Cookie `job-agent-offline` 与 middleware 联动**  
    `src/lib/supabase/middleware.ts` 在 offline cookie 存在时会跳过 Supabase 检查。切云端时必须清除该 cookie（`enableCloudMode()` 已处理）。

### 匹配逻辑

13. **「岗位职责」不是缺口**  
    `job-criteria.ts` 的 `SECTION_NOISE` 必须过滤，否则 JD 职责描述会被当成未满足条件。

14. **传播学识别要看多个字段**  
    用户可能写在摘要而非「专业」框；用 `findMatchingEducationLabel()`，不要只查单一字段。

15. **`calcUserResearchYears` 日期字段是 `startDate` / `endDate`**  
    曾误写为 `start` 导致经验年数算错。

### 构建 / 环境

16. **改代码后必须 `npm run build` 再 `npm start`**  
    生产模式跑的是 `.next` 缓存；只改 tsx 不 rebuild 用户看不到变化。`fix-and-start.sh` 会 `rm -rf .next` 后 build。

17. **`.env.local` 不要被 CDN 更新覆盖**  
    `update-via-cdn.sh` 会备份 `.env.local.bak`，但 `FILES` 里不应包含 `.env.local`。

18. **国内网络 + Supabase**  
    这不是代码 bug。Auth 超时、加载慢要引导 VPN，而不是再改回离线默认。

### Git / 分支

19. **Cloud Agent 分支名格式**  
    必须用 `cursor/<descriptive-name>-5260`，当前为 `cursor/job-finding-agent-5260`。

20. **`main` 分支版本较旧**  
    用户若从 `main` 拉 CDN 会拿到过时逻辑。开发都在 feature 分支。

### 无关干扰

21. **Claude Code CLI 报错**（`/usr/local/lib/claude-code/...`）与 JobAgent 无关，可忽略。

---

## 6. 关键文件地图

```
job-agent/
├── VERSION                          # 单一真相源，当前 0.2.37-cloud-only-default
├── HANDOFF.md                       # 本文件
├── fix-and-start.sh                 # 清缓存 + build + start（用户主入口）
├── go.sh                            # 调用 fix-and-start.sh
├── doctor.sh                        # 环境诊断
├── update-via-cdn.sh                # 无 GitHub 时的更新通道（FILES 列表很关键）
├── start.sh                         # 常规启动
├── .env.local                       # Supabase 配置（用户本地，不入库）
│
├── src/
│   ├── app/layout.tsx               # 首屏 cloud/offline cookie 预设脚本
│   ├── app/login/page.tsx           # 登录/注册；mount 时 enableCloudMode()
│   ├── components/AuthGuard.tsx     # 登录门禁、加载屏、CloudSyncStatus
│   ├── components/Sidebar.tsx       # 离线时显示「切换到云端登录」
│   ├── components/ExperienceManager.tsx
│   ├── components/SmartExperienceImport.tsx
│   ├── lib/storage.ts               # 核心：bootstrap、auth、cloud sync、模式切换
│   ├── lib/local-storage.ts         # offline/cloud localStorage + explicit 标记
│   ├── lib/matching.ts              # 匹配主逻辑
│   ├── lib/job-criteria.ts          # JD 条件解析
│   ├── lib/project-work-link.ts     # 项目→工作关联
│   ├── lib/weekly-report-parser.ts  # 周报解析
│   └── lib/supabase/middleware.ts   # offline cookie 时跳过 auth
│
├── scripts/verify-matching.ts       # 本地验证匹配逻辑
└── supabase/schema.sql              # 数据库表结构
```

### localStorage / Cookie 键名（调试必备）

| 键 | 含义 |
|----|------|
| `job-agent-cloud-mode` | `1` = 用户要云端 |
| `job-agent-offline` | `1` = 离线模式 |
| `job-agent-offline-explicit` | `1` = 用户**主动**选离线 |
| `job-agent-data` | 离线时的本机资料（云端用户应不存在） |
| Cookie `job-agent-offline` | 供 middleware 跳过 Supabase |

---

## 7. 开发命令速查

```bash
cd job-agent

# 安装
npm install

# 开发
npm run dev

# 生产构建验证（改代码后必跑）
npm run build

# 生产启动
npm start

# 匹配逻辑验证
npx tsx scripts/verify-matching.ts

# 用户侧一键修复启动
bash fix-and-start.sh
```

---

## 8. 用户需求原文摘要（避免跑偏）

1. 岗位匹配要准：用研 1–3 年、传播学专业不能显示「待补充」
2. 网页要能打开、能启动
3. 支持周报导入并更新项目经历，项目要标注所属工作
4. **只想云端登录，工作电脑不想留太多材料**（当前最高优先级之一）
5. 启动脚本不要 Permission denied

---

## 9. 会话接手检查清单

新会话开始时建议按顺序做：

- [ ] 读 `VERSION` 确认版本
- [ ] `git log -5` 看最近提交
- [ ] 确认用户在 Mac 上的 `VERSION` 是否与仓库一致
- [ ] 问用户：VPN 是否开启、能否打开 `/login`、侧边栏是否显示邮箱
- [ ] 若匹配问题：要 JD 文本 + 「我的经历」截图，跑 `verify-matching.ts`
- [ ] 改 `update-via-cdn.sh` 时同步 `FILES` + `EXPECTED_VERSION`
- [ ] 提交前 `npm run build`，push 后提醒用户 `bash update-via-cdn.sh`

---

*文档维护：每次解决用户阻塞问题或发布新版本时，更新第 3、4 节与 `VERSION`。*

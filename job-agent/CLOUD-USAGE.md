# 在云端使用 JobAgent（无需 Mac 终端更新）

## 推荐方案：只用 Cursor Cloud Agent

代码和服务器都在 **Cursor 云端** 维护。Cloud Agent 更新代码后会自动重启服务，你只需刷新浏览器。

### 一次性设置（2 分钟）

1. **关掉 Mac 本地的 JobAgent**
   - 若 Mac 终端里还在跑 `./start.sh`，按 `Ctrl+C` 停掉
   - 之后 **不要再在 Mac 上运行** `./start.sh`

2. **在 Cursor 桌面版打开本 Cloud Agent**
   - 打开：https://cursor.com/agents/bc-7c5e73b0-4cc6-4927-af88-9d568fc35260
   - 或在 Cursor 左侧 Agent 列表里选「工作匹配代理」

3. **用 Cursor 打开网页（关键）**
   - 在 Agent 面板找到 **Ports** / **端口** 或 **Open in Browser**
   - 点击 **3000** 端口的链接打开
   - ⚠️ **不要**用 Safari/Chrome 直接访问 `localhost:3000`（那会连到你 Mac 旧代码）

4. **验证是否连对**
   - 打开「我的经历」
   - 应看到：**版本 0.2.5 · 含「智能导入经历」**

### 日常使用

| 你想做的事 | 操作 |
|-----------|------|
| 使用 JobAgent | 从 Cursor Agent 里点端口 3000 打开 |
| 让 Agent 加功能 | 在 Agent 对话里提需求，Agent 会改代码并重启 |
| 刷新页面 | `Cmd+Shift+R` |
| 保存数据 | 默认离线模式，侧边栏「下载备份」 |

---

## 备选方案：部署到 Vercel（固定网址）

适合想要 **固定 URL**、不依赖 Cursor 开着的情况。

### 一次性部署

1. 打开 https://vercel.com 登录（可用 GitHub 账号）
2. **Add New Project** → 导入仓库 `marina2023124/marina2023124`
3. **Root Directory** 设为：`job-agent`
4. **Branch** 选：`cursor/job-finding-agent-5260`
5. 环境变量（可选，不用 Supabase 可跳过）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. 点击 **Deploy**

部署完成后会得到类似 `https://job-agent-xxx.vercel.app` 的地址。

### 之后

- Cloud Agent 推代码到 GitHub → Vercel **自动重新部署**
- 你只需刷新 Vercel 网址，**无需 Mac 终端**

---

## 为什么 Mac 的 localhost 一直是旧版？

```
Mac 终端 ./start.sh  →  localhost:3000  →  你 Mac 上的旧文件
Cursor 端口转发      →  localhost:3000  →  云端最新代码（Agent 维护）
Vercel 网址          →  线上自动部署    →  最新代码
```

三者互不影响。只用其中一种即可。

---

## 常见问题

**Q：Cursor 里找不到 Ports？**  
A：确认 Agent 状态为 Running，且 Agent 已执行过 `./start.sh`。可在 Agent 对话里说「帮我重启服务」。

**Q：想用云端同步（Supabase）？**  
A：在登录页选「尝试登录云端」，或配置 `.env.local` / Vercel 环境变量。

**Q：国内访问 Vercel 慢？**  
A：优先用 Cursor Cloud Agent 端口方式；数据用「下载备份」导出。

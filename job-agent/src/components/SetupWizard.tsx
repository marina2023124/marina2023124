"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, WifiOff } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, Input } from "@/components/ui";

const SCHEMA_SQL = `-- JobAgent 云端存储表结构
create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_app_data to authenticated;
grant select on public.user_app_data to anon;

drop policy if exists "Users can read own data" on public.user_app_data;
drop policy if exists "Users can insert own data" on public.user_app_data;
drop policy if exists "Users can update own data" on public.user_app_data;
drop policy if exists "Users can delete own data" on public.user_app_data;

create policy "Users can read own data"
  on public.user_app_data for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_app_data for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_app_data for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_app_data for delete to authenticated
  using (auth.uid() = user_id);`;

export function SetupWizard() {
  const router = useRouter();
  const { enterLocalMode } = useApp();
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  const copySql = async () => {
    await navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestOk(false);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, anonKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestOk(true);
        setTestResult("连接成功！数据表已就绪。");
      } else {
        setTestResult(data.error || "连接失败");
      }
    } catch {
      setTestResult("无法连接，请检查 URL 和密钥是否正确");
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/setup/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, anonKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveResult(data.message);
      } else {
        setSaveResult(data.error || "保存失败");
      }
    } catch {
      setSaveResult("保存失败，请手动创建 .env.local 文件");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">配置 Supabase 云端</h1>
        <p className="mt-2 text-sm text-slate-500">
          当前运行环境尚未配置 Supabase。若你之前在 Mac 上已配置过，填入<strong>相同的 URL 和 anon key</strong> 即可，无需新建项目。
        </p>
        <p className="mt-1 text-xs text-slate-400">
          配置保存在本机的 .env.local，换电脑/云端环境需要重新填一次（或复制 .env.local 文件）。
        </p>
      </div>

      <div className="flex justify-center">
        <Button
          variant="secondary"
          onClick={() => {
            enterLocalMode();
            router.replace("/");
          }}
        >
          <WifiOff className="h-4 w-4" />
          暂不配置，返回离线模式
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">1</span>
          <h2 className="font-semibold text-slate-900">创建 Supabase 项目</h2>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          前往 Supabase 注册并创建一个免费项目（Free tier 即可）。
        </p>
        <a
          href="https://supabase.com/dashboard/projects"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          打开 Supabase Dashboard
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">2</span>
          <h2 className="font-semibold text-slate-900">执行建表 SQL</h2>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          在 Supabase Dashboard → <strong>SQL Editor</strong> → New query，粘贴以下 SQL 并点击 Run：
        </p>
        <div className="relative">
          <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {SCHEMA_SQL}
          </pre>
          <button
            onClick={copySql}
            className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制 SQL"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">3</span>
          <h2 className="font-semibold text-slate-900">填入 API 密钥</h2>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          在 Supabase → <strong>Project Settings → API</strong> 复制以下两项：
        </p>
        <div className="space-y-4">
          <Input
            label="Project URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxx.supabase.co"
          />
          <Input
            label="anon public key"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          />

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={testConnection}
              disabled={!url || !anonKey || testing}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              测试连接
            </Button>
            <Button
              onClick={saveConfig}
              disabled={!url || !anonKey || saving || !testOk}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存配置
            </Button>
          </div>

          {testResult && (
            <div className={`rounded-lg px-3 py-2 text-sm ${testOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {testResult}
            </div>
          )}
          {saveResult && (
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              {saveResult}
              {saveResult.includes("重启") && (
                <p className="mt-2 font-medium">
                  请重启服务后刷新页面（终端 Ctrl+C，再运行 ./start.sh）
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">4</span>
          <h2 className="font-semibold text-emerald-900">重启并注册账号</h2>
        </div>
        <p className="text-sm text-emerald-800">
          保存配置并重启开发服务器后，刷新此页面即可看到登录/注册界面。
          在 Supabase → Authentication → Providers 中可关闭 Email 确认（开发环境可选）。
        </p>
      </div>
    </div>
  );
}

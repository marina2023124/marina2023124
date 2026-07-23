"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, WifiOff } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { maskSupabaseUrl, pingSupabaseProject } from "@/lib/supabase/ping";
import { SetupWizard } from "@/components/SetupWizard";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { enableCloudMode } from "@/lib/local-storage";

const AUTH_REQUEST_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function formatAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : "操作失败";
  if (/fetch failed|Failed to fetch|NetworkError|timeout|超时/i.test(message)) {
    return "无法连接项目 API（*.supabase.co），请确认 VPN 为全局模式后点「测试云端连接」";
  }
  if (/Invalid login credentials/i.test(message)) {
    return "邮箱或密码错误，请检查后重试";
  }
  if (/Email not confirmed/i.test(message)) {
    return "邮箱尚未验证，请先到邮箱点击验证链接";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const { enterLocalMode, user, authReady } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pingOk, setPingOk] = useState<boolean | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  useEffect(() => {
    enableCloudMode();
  }, []);

  useEffect(() => {
    if (authReady && user) {
      router.replace("/");
    }
  }, [authReady, user, router]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-6">
        <SetupWizard />
      </div>
    );
  }

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    setPingOk(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const result = await pingSupabaseProject(url, key);
    setPingOk(result.ok);
    setPingResult(result.message);
    setPinging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error: signUpError } = await withTimeout(
          supabase.auth.signUp({ email, password }),
          AUTH_REQUEST_TIMEOUT_MS,
          "注册请求超时，请检查 VPN 或网络后重试"
        );
        if (signUpError) throw signUpError;
        setMessage("注册成功！请查收邮件完成验证，或直接登录。");
      } else {
        const { error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          AUTH_REQUEST_TIMEOUT_MS,
          "登录请求超时，请检查 VPN 或网络后重试"
        );
        if (signInError) throw signInError;
        router.replace("/");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
            <Briefcase className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">JobAgent</h1>
          <p className="mt-2 text-sm text-slate-500">
            数据保存在云端，离开工作电脑不留本地记录
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="邮箱"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="密码"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />

            {error && (
              <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <p>{error}</p>
                <p className="text-xs text-red-500">
                  能打开 supabase.com 不代表项目 API 可达。登录实际访问的是{" "}
                  <span className="font-mono">{maskSupabaseUrl(supabaseUrl)}</span>
                </p>
              </div>
            )}
            {pingResult && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  pingOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                {pingResult}
              </div>
            )}
            {message && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : mode === "login" ? (
                "登录"
              ) : (
                "注册"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              disabled={pinging}
              onClick={handlePing}
            >
              {pinging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在测试项目 API…
                </>
              ) : (
                "测试云端连接（项目 API）"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            所有求职资料加密存储在 Supabase 云端，不会写入浏览器 localStorage
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-center text-xs text-slate-400">
              仅在 VPN 不可用、又急需编辑时的备用入口
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                enterLocalMode();
                router.replace("/");
              }}
            >
              <WifiOff className="h-4 w-4" />
              临时离线（资料会写入本机，不推荐工作电脑使用）
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

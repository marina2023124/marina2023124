"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, WifiOff } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/supabase/auth-errors";
import { maskSupabaseUrl, pingSupabaseProject } from "@/lib/supabase/ping";
import { SetupWizard } from "@/components/SetupWizard";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { enableCloudMode } from "@/lib/local-storage";

const AUTH_REQUEST_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

interface PingLine {
  label: string;
  ok: boolean;
  message: string;
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
  const [pingLines, setPingLines] = useState<PingLine[]>([]);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [proxyHint, setProxyHint] = useState<string | null>(null);

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
    setPingLines([]);
    setServerReachable(null);
    setProxyHint(null);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    const browserResult = await pingSupabaseProject(url, key);
    const lines: PingLine[] = [
      {
        label: "浏览器 → 项目 API",
        ok: browserResult.ok,
        message: browserResult.message,
      },
    ];

    try {
      const res = await fetch("/api/setup/ping");
      const serverResult = (await res.json()) as {
        ok: boolean;
        message: string;
        proxy?: { configured: boolean; url?: string };
      };
      lines.push({
        label: "本机服务 → 项目 API",
        ok: serverResult.ok,
        message: serverResult.message,
      });
      setServerReachable(serverResult.ok);

      if (serverResult.proxy?.configured) {
        setProxyHint(`本机服务已启用代理：${serverResult.proxy.url}`);
      } else if (!serverResult.ok) {
        setProxyHint(
          "Clash 用户：在 .env.local 添加 HTTPS_PROXY=http://127.0.0.1:7890，然后重新运行 bash fix-and-start.sh"
        );
      }
    } catch {
      lines.push({
        label: "本机服务 → 项目 API",
        ok: false,
        message: "无法访问本机 API，请确认 dev 服务已启动",
      });
      setServerReachable(false);
    }

    setPingLines(lines);
    setPinging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    try {
      const res = await withTimeout(
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
        AUTH_REQUEST_TIMEOUT_MS,
        "请求超时：本机服务无法连接 Supabase，请换 VPN 节点或改用线上地址"
      );

      const body = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || body.error) {
        throw new Error(body.error ?? "操作失败");
      }

      if (mode === "signup") {
        setMessage("注册成功！请查收邮件完成验证，或直接登录。");
      } else {
        window.location.href = "/";
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
                  能打开 supabase.com 不代表项目 API 可达。登录经本机服务转发，实际访问的是{" "}
                  <span className="font-mono">{maskSupabaseUrl(supabaseUrl)}</span>
                </p>
                {serverReachable === false && (
                  <div className="space-y-1 text-xs text-red-500">
                    <p>
                      本机服务也无法连接 Supabase。可尝试：① Clash 开「系统代理」或「TUN 模式」；② 在
                      .env.local 加 <span className="font-mono">HTTPS_PROXY=http://127.0.0.1:7890</span>{" "}
                      后重启；③ 改用{" "}
                      <a
                        href="https://marina2023124.vercel.app/login"
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        线上版
                      </a>
                    </p>
                  </div>
                )}
              </div>
            )}
            {pingLines.length > 0 && (
              <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {pingLines.map((line) => (
                  <div key={line.label} className={line.ok ? "text-emerald-700" : "text-amber-800"}>
                    <span className="font-medium">{line.label}：</span>
                    {line.message}
                  </div>
                ))}
                {serverReachable && pingLines.some((l) => !l.ok) && (
                  <p className="text-xs text-emerald-700">
                    浏览器直连失败不影响登录，本机服务可转发请求，请直接点「登录」重试。
                  </p>
                )}
                {proxyHint && (
                  <p className="text-xs text-slate-600">{proxyHint}</p>
                )}
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
                  正在测试连接…
                </>
              ) : (
                "测试云端连接（浏览器 + 本机服务）"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            登录与同步经本机 Next.js 服务转发，浏览器无需直连 *.supabase.co
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

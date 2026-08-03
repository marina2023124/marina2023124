"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw } from "lucide-react";

export function WechatLinkPanel() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/wechat/bind-code");
      const body = (await res.json()) as { linked?: boolean; error?: string };
      if (!res.ok) throw new Error(body.error ?? "查询失败");
      setLinked(Boolean(body.linked));
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
      setLinked(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/wechat/bind-code", { method: "POST" });
      const body = (await res.json()) as {
        code?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "生成绑定码失败");
      setCode(body.code ?? null);
      setExpiresAt(body.expiresAt ?? null);
      setLinked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成绑定码失败");
    } finally {
      setLoading(false);
    }
  };

  if (linked === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        检查微信绑定状态…
      </div>
    );
  }

  if (linked) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <Link2 className="mr-1 inline h-3.5 w-3.5" />
        已与微信小程序账号打通，数据实时同步
      </div>
    );
  }

  const needsSchemaFix = error?.includes("permission denied") || error?.includes("does not exist");

  return (
    <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-900">
        <Link2 className="h-4 w-4" />
        绑定微信小程序
      </div>
      <p className="text-xs leading-relaxed text-indigo-800/90">
        生成 6 位绑定码，在小程序「首页 → 绑定网页账号」输入，即可与网页共用同一份数据。
      </p>

      {needsSchemaFix && (
        <p className="rounded-lg bg-amber-50 px-2 py-2 text-xs leading-relaxed text-amber-800">
          数据库尚未配置绑定表权限。请在 Supabase SQL Editor 执行
          {" "}
          <code className="text-[10px]">supabase/wechat-link-schema-fix.sql</code>
          {" "}
          后刷新本页。
        </p>
      )}

      {code ? (
        <div className="rounded-lg bg-white px-3 py-3 text-center">
          <p className="text-xs text-slate-500">绑定码（10 分钟内有效）</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-indigo-700">{code}</p>
          {expiresAt && (
            <p className="mt-1 text-[10px] text-slate-400">
              过期时间：{new Date(expiresAt).toLocaleTimeString("zh-CN")}
            </p>
          )}
        </div>
      ) : null}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void generateCode()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中…
          </>
        ) : code ? (
          <>
            <RefreshCw className="h-4 w-4" />
            重新生成绑定码
          </>
        ) : (
          "生成绑定码"
        )}
      </button>
    </div>
  );
}

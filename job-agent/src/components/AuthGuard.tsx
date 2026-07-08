"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Cloud, Loader2 } from "lucide-react";
import { Button } from "./ui";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loaded, authReady, isConfigured, forceReady } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loaded || !authReady) return;
    if (!isConfigured && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    if (!isConfigured) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loaded, authReady, isConfigured, pathname, router]);

  const loadingScreen = (message: string) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-600">{message}</p>
        <p className="text-xs text-slate-400">
          国内网络通常需要 VPN 才能访问 supabase.co
        </p>
        {showSkip && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 w-full">
            <p className="mb-3 text-sm text-amber-900">
              一直转圈说明连不上 Supabase 云端。请先<strong>开启 VPN</strong>，再刷新页面；或暂时跳过进入登录页重试。
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                forceReady();
                router.replace("/login");
              }}
            >
              跳过等待，进入登录页
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (!authReady) {
    return loadingScreen("正在连接云端...");
  }

  if (!isConfigured) {
    if (pathname === "/login") {
      return <>{children}</>;
    }
    return loadingScreen("正在跳转...");
  }

  if (!loaded) {
    return loadingScreen("正在从云端加载数据...");
  }

  if (!user && pathname !== "/login") {
    return loadingScreen("正在跳转登录...");
  }

  return <>{children}</>;
}

export function CloudSyncStatus() {
  const { syncing, syncError, lastSyncedAt } = useApp();

  if (syncError) {
    return (
      <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
        同步失败：{syncError}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
      {syncing ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          正在同步到云端...
        </>
      ) : (
        <>
          <Cloud className="h-3 w-3" />
          数据已保存在云端
          {lastSyncedAt && (
            <span className="text-emerald-500">
              · {new Date(lastSyncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </>
      )}
    </div>
  );
}

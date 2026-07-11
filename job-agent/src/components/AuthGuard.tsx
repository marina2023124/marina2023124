"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Cloud, Loader2, WifiOff } from "lucide-react";
import { enableCloudMode, wantsCloudMode } from "@/lib/local-storage";
import { Button } from "./ui";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loaded, authReady, isConfigured, localMode, forceReady, enterLocalMode } =
    useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loaded || !authReady) return;

    // 登录页始终放行（配置 Supabase / 云端登录）
    if (pathname === "/login") return;

    if (localMode) return;

    if (!isConfigured) {
      router.replace("/login");
      return;
    }
    if (!user) {
      router.replace("/login");
    }
  }, [user, loaded, authReady, isConfigured, localMode, pathname, router]);

  const loadingScreen = (message: string) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-600">{message}</p>
        <p className="text-xs text-slate-400">国内网络通常需要 VPN 才能访问 supabase.co</p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 w-full space-y-3">
          <p className="text-sm text-amber-900">一直转圈？先离线使用，稍后再试云端：</p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              enterLocalMode();
              router.replace("/");
            }}
          >
            <WifiOff className="mr-2 h-4 w-4" />
            离线使用（立即可用）
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => {
              enableCloudMode();
              forceReady();
              router.replace("/login");
            }}
          >
            前往云端登录页
          </Button>
        </div>
      </div>
    </div>
  );

  // 登录/配置页不拦截
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 离线模式直接显示
  if (localMode) {
    return <>{children}</>;
  }

  // 用户主动选了云端，尽快进入登录流程
  if (wantsCloudMode() && !user) {
    if (!authReady || !loaded) {
      return <>{children}</>;
    }
  }

  if (!authReady) {
    return loadingScreen("正在连接云端...");
  }

  if (!isConfigured) {
    return loadingScreen("正在跳转配置页...");
  }

  if (!loaded) {
    return loadingScreen("正在从云端加载数据...");
  }

  if (!user) {
    return loadingScreen("正在跳转登录...");
  }

  return <>{children}</>;
}

export function CloudSyncStatus() {
  const { syncing, syncError, lastSyncedAt, localMode } = useApp();

  if (localMode) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <WifiOff className="h-3 w-3" />
        离线模式 · 数据保存在本机浏览器
      </div>
    );
  }

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

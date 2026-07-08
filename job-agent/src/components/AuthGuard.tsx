"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Cloud, Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loaded, isConfigured } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loaded) return;
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
  }, [user, loaded, isConfigured, pathname, router]);

  if (!isConfigured) {
    if (pathname === "/login") {
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm">正在从云端加载数据...</p>
        </div>
      </div>
    );
  }

  if (!user && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
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

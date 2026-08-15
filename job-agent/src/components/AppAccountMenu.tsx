"use client";

import Link from "next/link";
import { Cloud, Download, ListChecks, LogOut, Upload } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { CloudSyncStatus } from "@/components/AuthGuard";
import { WechatLinkPanel } from "@/components/WechatLinkPanel";

export function AppAccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { exportData, importData, signOut, user, localMode, guestMode, enterCloudMode } =
    useApp();

  return (
    <div className="space-y-3">
      <CloudSyncStatus />

      {(localMode || guestMode) && (
        <button
          onClick={() => {
            onNavigate?.();
            enterCloudMode();
          }}
          className="flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
        >
          <Cloud className="h-4 w-4" />
          {guestMode ? "退出访客模式并登录" : "切换到云端登录"}
        </button>
      )}

      {user && !guestMode && (
        <p className="truncate px-1 text-xs text-slate-400">{user.email}</p>
      )}

      {user && !guestMode && !localMode && <WechatLinkPanel />}

      <Link
        href="/offboard"
        onClick={() => onNavigate?.()}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <ListChecks className="h-4 w-4" />
        离职备份与清理
      </Link>
      <button
        onClick={exportData}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <Download className="h-4 w-4" />
        下载备份
      </button>
      <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        从文件恢复
        <input
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importData(file);
          }}
        />
      </label>
      {user && !guestMode && (
        <button
          onClick={() => {
            onNavigate?.();
            void signOut();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      )}
    </div>
  );
}

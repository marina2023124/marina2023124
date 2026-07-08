"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Home,
  MessageSquare,
  Target,
  User,
  Download,
  Upload,
  LogOut,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { CloudSyncStatus } from "@/components/AuthGuard";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "仪表盘", icon: Home },
  { href: "/experience", label: "我的经历", icon: User },
  { href: "/jobs", label: "岗位管理", icon: Briefcase },
  { href: "/match", label: "智能匹配", icon: Target },
  { href: "/agent", label: "职业顾问", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { exportData, importData, signOut, user } = useApp();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">JobAgent</h1>
            <p className="text-xs text-slate-500">云端求职助手</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-indigo-600")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 space-y-3">
        <CloudSyncStatus />

        {user && (
          <p className="truncate px-1 text-xs text-slate-400">{user.email}</p>
        )}

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
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/login";

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}

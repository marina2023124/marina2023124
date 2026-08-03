"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { navItems } from "@/lib/nav-items";
import { AppAccountMenu } from "@/components/AppAccountMenu";
import { BottomNav, MobileHeader } from "@/components/MobileShell";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { guestMode } = useApp();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">JobAgent</h1>
            <p className="text-xs text-slate-500">
              {guestMode ? "访客体验" : "云端求职助手"}
            </p>
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

      <div className="border-t border-slate-200 p-4">
        <AppAccountMenu />
      </div>
    </aside>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showShell = pathname !== "/login" && pathname !== "/try";

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileHeader />
      <main className="min-h-screen overflow-x-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Briefcase, Loader2, Sparkles, WifiOff } from "lucide-react";
import { enableGuestMode, primeTryPageOffline } from "@/lib/local-storage";
import { Button } from "@/components/ui";

function startGuestExperience(withSampleData: boolean) {
  enableGuestMode(withSampleData);
  window.location.href = "/";
}

export default function TryPage() {
  const [loading, setLoading] = useState<"sample" | "blank" | null>(null);

  useEffect(() => {
    primeTryPageOffline();
  }, []);

  const handleEnter = (withSampleData: boolean) => {
    setLoading(withSampleData ? "sample" : "blank");
    startGuestExperience(withSampleData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50 px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">JobAgent 访客体验</h1>
            <p className="text-sm text-slate-500">无需注册 · 无需 VPN · 直接试用</p>
          </div>
        </div>

        <div className="mb-6 space-y-2 text-sm text-slate-600">
          <p>适合发给朋友或面试官快速体验：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>岗位管理、猎聘/小红书链接导入</li>
            <li>智能匹配与职业顾问对话</li>
            <li>数据仅保存在访客自己的浏览器，与你的账号无关</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={loading !== null}
            onClick={() => handleEnter(true)}
          >
            {loading === "sample" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            加载示例数据并体验
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={loading !== null}
            onClick={() => handleEnter(false)}
          >
            {loading === "blank" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            空白体验（自行录入）
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          已有账号？
          <a href="/login" className="ml-1 text-indigo-600 hover:underline">
            前往登录
          </a>
        </p>
      </div>
    </div>
  );
}

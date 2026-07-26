"use client";

import { ExperienceManager } from "@/components/ExperienceManager";

export default function ExperiencePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">我的经历</h1>
        <p className="mt-1 text-slate-500">
          粘贴简历/项目表，或用周报增量更新项目；项目将按时间自动关联到对应工作
        </p>
        <p className="mt-1 text-xs font-medium text-indigo-600">版本 0.2.75 · 项目清理与云端自动修复</p>
      </div>
      <ExperienceManager />
    </div>
  );
}

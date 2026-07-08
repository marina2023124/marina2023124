"use client";

import { ExperienceManager } from "@/components/ExperienceManager";

export default function ExperiencePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">我的经历</h1>
        <p className="mt-1 text-slate-500">
          粘贴简历或上传 PDF/Word/Excel，自动识别经历；也可在下方手动编辑
        </p>
        <p className="mt-1 text-xs font-medium text-indigo-600">版本 0.2.5 · 含「智能导入经历」</p>
      </div>
      <ExperienceManager />
    </div>
  );
}

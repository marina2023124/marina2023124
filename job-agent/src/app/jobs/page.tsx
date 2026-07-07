"use client";

import { JobManager } from "@/components/JobManager";

export default function JobsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">岗位管理</h1>
        <p className="mt-1 text-slate-500">
          添加感兴趣的 JD，系统会自动提取技能要求
        </p>
      </div>
      <JobManager />
    </div>
  );
}

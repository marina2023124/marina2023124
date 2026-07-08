"use client";

import { JobManager } from "@/components/JobManager";

export default function JobsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">岗位管理</h1>
        <p className="mt-1 text-slate-500">
          粘贴 JD 文字或上传截图，自动识别岗位、公司、薪资和技能要求
        </p>
      </div>
      <JobManager />
    </div>
  );
}

"use client";

import { JobManager } from "@/components/JobManager";

export default function JobsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">岗位管理</h1>
        <p className="mt-1 text-slate-500">
          支持 BOSS 书签、猎聘/小红书链接、JD 文字或截图导入；所有岗位会标注信息来源
        </p>
        <p className="mt-1 text-xs font-medium text-indigo-600">版本 0.2.77 · 多渠道导入与来源标注</p>
      </div>
      <JobManager />
    </div>
  );
}

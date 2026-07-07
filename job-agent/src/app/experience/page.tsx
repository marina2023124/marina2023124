"use client";

import { ExperienceManager } from "@/components/ExperienceManager";

export default function ExperiencePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">我的经历</h1>
        <p className="mt-1 text-slate-500">
          梳理你的工作经历、技能和项目，为智能匹配打下基础
        </p>
      </div>
      <ExperienceManager />
    </div>
  );
}

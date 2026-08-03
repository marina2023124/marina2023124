"use client";

import type { JdRequirementMatch } from "@/lib/types";
import { Badge } from "./ui";

const STATUS_CONFIG = {
  direct: { label: "直接匹配", color: "green" as const },
  partial: { label: "相近经历", color: "amber" as const },
  missing: { label: "暂无匹配", color: "slate" as const },
};

function RequirementRow({ item }: { item: JdRequirementMatch }) {
  const status = STATUS_CONFIG[item.status];

  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        item.status === "direct"
          ? "border-emerald-100 bg-emerald-50/50"
          : item.status === "partial"
            ? "border-amber-100 bg-amber-50/40"
            : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800">{item.text}</p>
        <Badge color={status.color}>{status.label}</Badge>
      </div>

      {item.projectName && item.experienceText ? (
        <div className="mt-2 border-t border-white/60 pt-2">
          <p className="text-xs font-medium text-indigo-700">
            {item.workExperienceLabel} · {item.projectName}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.experienceText}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">暂无可直接引用的项目经历</p>
      )}

      {item.note && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.note}</p>
      )}
    </div>
  );
}

export function JdRequirementMatchList({
  items,
  source,
}: {
  items: JdRequirementMatch[];
  source?: "rule" | "ai";
}) {
  if (!items.length) return null;

  const responsibilities = items.filter((item) => item.category === "responsibility");
  const requirements = items.filter((item) => item.category === "requirement");

  const directCount = items.filter((item) => item.status === "direct").length;
  const partialCount = items.filter((item) => item.status === "partial").length;
  const missingCount = items.filter((item) => item.status === "missing").length;

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase text-slate-400">岗位描述 ↔ 对应经历</p>
        {source && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              source === "ai" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {source === "ai" ? "AI 逐条匹配" : "规则逐条匹配"}
          </span>
        )}
        <span className="text-[10px] text-slate-400">
          直接 {directCount} · 相近 {partialCount} · 缺失 {missingCount}
        </span>
      </div>

      <div className="space-y-5">
        {responsibilities.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold text-slate-600">岗位职责</p>
            <div className="space-y-2">
              {responsibilities.map((item) => (
                <RequirementRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {requirements.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold text-slate-600">任职要求</p>
            <div className="space-y-2">
              {requirements.map((item) => (
                <RequirementRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

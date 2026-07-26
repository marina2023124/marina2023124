import { formatJdExperienceYears, formatPlatformExperienceLabel } from "@/lib/job-experience";

export function JobExperienceSummary({
  experienceYears,
  platformExperienceLabel,
  compact = false,
}: {
  experienceYears?: number;
  platformExperienceLabel?: string;
  compact?: boolean;
}) {
  const jdText = formatJdExperienceYears(experienceYears);
  const platformText = formatPlatformExperienceLabel(platformExperienceLabel);
  const showPlatform = Boolean(platformExperienceLabel?.trim());

  if (compact) {
    return (
      <>
        {experienceYears != null && experienceYears > 0 && (
          <span>JD {jdText}</span>
        )}
        {showPlatform && (
          <span className="text-slate-400" title="平台筛选项，非 JD 正文硬性要求">
            平台 {platformText}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      <div>
        <span className="text-slate-500">经验要求（JD）：</span>
        <span className="text-slate-800">{jdText}</span>
      </div>
      {showPlatform && (
        <div>
          <span className="text-slate-500">平台标签：</span>
          <span className="text-slate-800">{platformText}</span>
          <span className="ml-1 text-xs text-slate-400">（非 JD 正文）</span>
        </div>
      )}
    </>
  );
}

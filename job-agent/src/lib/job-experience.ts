/** 岗位经验：JD 正文要求 vs 平台筛选项（如小红书 workExperience） */

export function formatJdExperienceYears(years?: number): string {
  if (years == null) return "—";
  if (years === 0) return "不限/应届";
  return `${years}年`;
}

export function formatPlatformExperienceLabel(label?: string): string {
  return label?.trim() || "—";
}

export const XHS_WORK_EXPERIENCE_LABELS: Record<string, string> = {
  no_limit: "经验不限",
  graduate: "应届",
  one_year: "1年",
  one_to_three_year: "1-3年",
  three_to_five_year: "3-5年",
  five_to_ten_year: "5-10年",
  ten_year_more: "10年以上",
};

export function xhsWorkExperienceToLabel(code?: string): string | undefined {
  if (!code?.trim()) return undefined;
  return XHS_WORK_EXPERIENCE_LABELS[code] ?? code;
}

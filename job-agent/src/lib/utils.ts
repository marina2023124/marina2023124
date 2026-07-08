export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-");
  return `${year}年${month ? `${month}月` : ""}`;
}

export function calcYearsBetween(start: string, end?: string): number {
  const startDate = new Date(start + "-01");
  const endDate = end ? new Date(end + "-01") : new Date();
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(0, months / 12);
}

export function calcTotalExperienceYears(
  experiences: { startDate: string; endDate?: string }[]
): number {
  if (experiences.length === 0) return 0;
  const sorted = [...experiences].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );
  let totalMonths = 0;
  for (const exp of sorted) {
    const start = new Date(exp.startDate + "-01");
    const end = exp.endDate ? new Date(exp.endDate + "-01") : new Date();
    totalMonths +=
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
  }
  return Math.round((totalMonths / 12) * 10) / 10;
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

export function parseSkillsFromText(text: string): string[] {
  const separators = /[,，、;；|\n/]+/;
  return Array.from(new Set(text.split(separators).map((s) => s.trim()).filter(Boolean)));
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-");
  return `${year}年${month ? `${month}月` : ""}`;
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const [yearRaw, monthRaw] = dateStr.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw || "1");
  if (!Number.isFinite(year) || year < 1900 || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function toMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Resume OCR/import often misreads 2024 as 2026 — correct future work start years. */
export function sanitizeWorkYear(year: number): number {
  const currentYear = getCurrentYearMonth().year;
  if (year <= currentYear) return year;
  if (year - 2 <= currentYear) return year - 2;
  if (year - 1 <= currentYear) return year - 1;
  return year;
}

export function sanitizeWorkDate(dateStr: string): string {
  const ym = parseYearMonth(dateStr);
  if (!ym) return dateStr;
  const year = sanitizeWorkYear(ym.year);
  return `${year}-${String(ym.month).padStart(2, "0")}`;
}

/** Inclusive month span: Apr 2024 through Jul 2026 = 28 months. */
export function calcMonthsBetween(start: string, end?: string): number {
  const startYm = parseYearMonth(start);
  if (!startYm) return 0;

  const endYm = end ? parseYearMonth(end) : getCurrentYearMonth();
  if (!endYm) return 0;

  const startIdx = toMonthIndex(startYm.year, startYm.month);
  const endIdx = toMonthIndex(endYm.year, endYm.month);
  if (endIdx < startIdx) return 0;

  return endIdx - startIdx + 1;
}

export function calcYearsBetween(start: string, end?: string): number {
  return Math.round((calcMonthsBetween(start, end) / 12) * 10) / 10;
}

export function isFutureYearMonth(dateStr: string): boolean {
  const ym = parseYearMonth(dateStr);
  if (!ym) return false;
  const current = getCurrentYearMonth();
  return toMonthIndex(ym.year, ym.month) > toMonthIndex(current.year, current.month);
}

export function calcTotalExperienceYears(
  experiences: { startDate: string; endDate?: string }[]
): number {
  if (experiences.length === 0) return 0;

  const intervals = experiences
    .map((exp) => {
      const startYm = parseYearMonth(sanitizeWorkDate(exp.startDate));
      if (!startYm) return null;
      const endYm = exp.endDate
        ? parseYearMonth(sanitizeWorkDate(exp.endDate))
        : getCurrentYearMonth();
      if (!endYm) return null;

      const start = toMonthIndex(startYm.year, startYm.month);
      const end = toMonthIndex(endYm.year, endYm.month);
      if (end < start) return null;
      return { start, end };
    })
    .filter((iv): iv is { start: number; end: number } => iv !== null)
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) return 0;

  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end + 1) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  let totalMonths = 0;
  for (const interval of merged) {
    totalMonths += interval.end - interval.start + 1;
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

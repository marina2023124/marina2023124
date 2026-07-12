/** Extract WK numbers from labeled task highlights, e.g. "WK28 …" → 28 */
export function extractHighlightWeekNumbers(highlights: string[] = []): number[] {
  const weeks: number[] = [];
  for (const item of highlights) {
    const match = item.match(/^WK(\d{1,2})\b/i);
    if (match) weeks.push(Number(match[1]));
  }
  return weeks;
}

/** Latest WK across all projects — used as the reporting horizon for stale checks */
export function getReferenceWeekNumber(
  projects: { highlights?: string[] }[]
): number {
  const weeks = projects.flatMap((p) => extractHighlightWeekNumbers(p.highlights ?? []));
  return weeks.length ? Math.max(...weeks) : 0;
}

export const STALE_WEEK_GAP = 3;

export function isProjectStale(
  project: { highlights?: string[]; endDate?: string },
  referenceWeek: number,
  todayIso = new Date().toISOString().slice(0, 10)
): boolean {
  const weeks = extractHighlightWeekNumbers(project.highlights ?? []);
  if (weeks.length && referenceWeek > 0) {
    const lastWeek = Math.max(...weeks);
    return referenceWeek - lastWeek >= STALE_WEEK_GAP;
  }

  if (project.endDate && todayIso > project.endDate) {
    const end = new Date(`${project.endDate}T00:00:00`);
    const today = new Date(`${todayIso}T00:00:00`);
    const gapDays = Math.round((today.getTime() - end.getTime()) / 86400000);
    return gapDays >= STALE_WEEK_GAP * 7;
  }

  return false;
}

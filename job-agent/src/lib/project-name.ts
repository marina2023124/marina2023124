const PROJECT_STATUS_SUFFIX_RE =
  /[，,]\s*(已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进)\s*$/i;

/** 去掉项目名称中的状态标记，如「XTS决策链路，已达成」→「XTS决策链路」 */
export function normalizeProjectName(name: string): string {
  return name
    .replace(/[，,]\s*(已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进)/gi, "")
    .replace(PROJECT_STATUS_SUFFIX_RE, "")
    .replace(/\s*(已达成|未达成|已推进|已同步)\s*$/i, "")
    .trim();
}

/** 为任务明细加上来源周次，如「WK28 因本周优先…」 */
export function labelWeeklyTasks(tasks: string[], weekLabel?: string): string[] {
  if (!weekLabel) return tasks;
  return tasks.map((task) => {
    const trimmed = task.trim();
    if (!trimmed) return trimmed;
    if (new RegExp(`^${weekLabel}\\b`, "i").test(trimmed)) return trimmed;
    if (/^WK\d{1,2}\b/i.test(trimmed)) return trimmed;
    return `${weekLabel} ${trimmed}`;
  });
}

export function stripWeekPrefix(task: string): string {
  return task.replace(/^WK\d{1,2}\s+/, "").trim();
}

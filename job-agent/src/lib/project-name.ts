const PROJECT_STATUS_SUFFIX_RE =
  /[，,]\s*(已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进|实际达成)\s*$/i;
const PRIORITY_PREFIX_RE = /^P[0-3](?:【[^】]+】)?\s*/i;
/** 周报项目状态标签（非项目名称的一部分） */
export const PROJECT_STATUS_TAG_RE =
  /【(?:被动调整|主动调整|新增高优|本周新增|紧急新增|执行待定)】\s*/g;

const GENERIC_STATUS_BRACKET_RE =
  /[【［\[]?(?:被动调整|主动调整|新增高优|本周新增|紧急新增|执行待定)[】］\]]?\s*/g;

/** 去掉项目名称中的优先级与状态标记 */
export function normalizeProjectName(name: string): string {
  let result = name.trim();
  for (let i = 0; i < 4; i++) {
    const next = result
      .replace(PRIORITY_PREFIX_RE, "")
      .replace(PROJECT_STATUS_TAG_RE, "")
      .replace(GENERIC_STATUS_BRACKET_RE, "")
      .replace(/^[。.．、,，]+|[。.．、,，]+$/g, "")
      .replace(/[，,]\s*(已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进|实际达成)/gi, "")
      .replace(PROJECT_STATUS_SUFFIX_RE, "")
      .replace(/\s*(已达成|未达成|已推进|已同步|实际达成)\s*$/i, "")
      .trim();
    if (next === result) break;
    result = next;
  }
  return result;
}

/** 清理任务明细中的优先级、状态与重复标点 */
export function normalizeTaskHighlight(text: string): string {
  const weekMatch = text.match(/^(WK\d{1,2})\s+(.+)$/i);
  const weekLabel = weekMatch?.[1];
  let body = (weekMatch?.[2] ?? text).trim();

  body = body
    .replace(PRIORITY_PREFIX_RE, "")
    .replace(/^【[^】]+】\s*/, "")
    .replace(/^(已达成|未达成|已推进|已同步|实际达成)[、，,。\s]+/i, "")
    .replace(/[，,]\s*(已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进|实际达成)\s*[。.]*$/gi, "")
    .replace(/[。.]{2,}/g, "。")
    .replace(/^[。.]+|[。.]+$/g, "")
    .trim();

  if (!body) return "";
  return weekLabel ? `${weekLabel} ${body}` : body;
}

/** 过滤纯状态行、空行或整行项目标题回声 */
export function isNoiseTaskHighlight(text: string): boolean {
  const bare = stripWeekPrefix(normalizeTaskHighlight(text));
  if (!bare || bare.length < 4) return true;
  if (/^(已达成|未达成|已推进|已同步|实际达成)[。.]?$/i.test(bare)) return true;
  if (/^R2新品规划PSM\+弹性测试，?$/i.test(bare)) return true;
  if (/^P[0-3]/i.test(bare) && /已达成|已推进/.test(bare) && bare.length < 48) {
    return true;
  }
  if (/^计划[：:]/i.test(bare) || /^卡点[：:]/i.test(bare)) return true;
  return false;
}

/** 为任务明细加上来源周次，如「WK28 因本周优先…」 */
export function labelWeeklyTasks(tasks: string[], weekLabel?: string): string[] {
  if (!weekLabel) return tasks;
  return tasks.map((task) => {
    const trimmed = normalizeTaskHighlight(task);
    if (!trimmed || isNoiseTaskHighlight(trimmed)) return "";
    if (new RegExp(`^${weekLabel}\\b`, "i").test(trimmed)) return trimmed;
    if (/^WK\d{1,2}\b/i.test(trimmed)) return trimmed;
    return `${weekLabel} ${stripWeekPrefix(trimmed)}`;
  }).filter(Boolean);
}

export function stripWeekPrefix(task: string): string {
  return task.replace(/^WK\d{1,2}\s+/, "").trim();
}

function tasksEquivalent(a: string, b: string): boolean {
  const bareA = stripWeekPrefix(a).trim();
  const bareB = stripWeekPrefix(b).trim();
  if (!bareA || !bareB) return false;
  if (bareA === bareB) return true;
  if (bareA.length >= 8 && bareB.length >= 8) {
    return bareA.includes(bareB) || bareB.includes(bareA);
  }
  return false;
}

/** 合并任务明细，优先保留带 WK 前缀的版本 */
export function mergeWeeklyHighlights(current: string[], incoming: string[]): string[] {
  const result = current
    .map((item) => normalizeTaskHighlight(item))
    .filter((item) => item && !isNoiseTaskHighlight(item));

  for (const raw of incoming) {
    const normalized = normalizeTaskHighlight(raw);
    if (!normalized || isNoiseTaskHighlight(normalized)) continue;

    const hasWeek = /^WK\d{1,2}\b/i.test(normalized);
    let merged = false;

    for (let i = 0; i < result.length; i++) {
      if (!tasksEquivalent(result[i], normalized)) continue;
      if (hasWeek && !/^WK\d{1,2}\b/i.test(result[i])) {
        result[i] = normalized;
      }
      merged = true;
      break;
    }

    if (!merged) {
      result.push(normalized);
    }
  }

  return finalizeWeeklyHighlights(result);
}

/** 拆分「WK25 A。B」为两条独立明细 */
export function splitCombinedWeeklyHighlights(highlights: string[]): string[] {
  const result: string[] = [];
  for (const raw of highlights) {
    const h = normalizeTaskHighlight(raw);
    if (!h) continue;
    const wkMatch = h.match(/^(WK\d{1,2})\s+(.+)$/i);
    if (!wkMatch) {
      result.push(h);
      continue;
    }
    const week = wkMatch[1];
    const body = wkMatch[2];
    const parts = body
      .split(/[。.]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 4 && !isNoiseTaskHighlight(p));
    if (parts.length <= 1) {
      result.push(`${week} ${body.replace(/[。.]+$/, "")}`);
      continue;
    }
    for (const part of parts) {
      result.push(`${week} ${part}`);
    }
  }
  return result;
}

/** 为缺 WK 前缀的碎片明细补上来源周次，或去掉已被包含的重复项 */
export function relabelOrphanFragments(highlights: string[]): string[] {
  const labeled = highlights.filter((h) => /^WK\d{1,2}\b/i.test(h));
  const orphans = highlights.filter((h) => !/^WK\d{1,2}\b/i.test(h));
  const result = [...labeled];

  for (const orphan of orphans) {
    const bare = orphan.trim();
    if (!bare || bare.length < 4) continue;

    const contained = labeled.some((item) => {
      const body = stripWeekPrefix(item);
      return body.includes(bare) || bare.includes(body);
    });
    if (contained) continue;

    const host = labeled.find((item) => {
      const body = stripWeekPrefix(item);
      return (
        body.includes(bare.slice(0, Math.min(6, bare.length))) ||
        bare.includes(body.slice(0, Math.min(6, body.length)))
      );
    });
    if (host) {
      const week = host.match(/^(WK\d{1,2})\b/i)?.[1];
      if (week) {
        result.push(`${week} ${bare}`);
        continue;
      }
    }
    result.push(bare);
  }

  return dedupeWeeklyHighlights(result);
}

/** 去掉内容相同但缺 WK 前缀的重复明细 */
export function dedupeWeeklyHighlights(highlights: string[]): string[] {
  const cleaned = highlights
    .map((item) => normalizeTaskHighlight(item))
    .filter((item) => item && !isNoiseTaskHighlight(item));

  const result: string[] = [];

  for (const item of cleaned) {
    let merged = false;
    for (let i = 0; i < result.length; i++) {
      if (!tasksEquivalent(result[i], item)) continue;
      const itemHasWeek = /^WK\d{1,2}\b/i.test(result[i]);
      const incomingHasWeek = /^WK\d{1,2}\b/i.test(item);
      if (incomingHasWeek && !itemHasWeek) {
        result[i] = item;
      }
      merged = true;
      break;
    }
    if (!merged) result.push(item);
  }

  return result.filter((item) => {
    if (/^WK\d{1,2}\b/i.test(item)) return true;
    return !result.some(
      (other) =>
        other !== item &&
        /^WK\d{1,2}\b/i.test(other) &&
        tasksEquivalent(other, item)
    );
  });
}

function parseWeekHighlight(item: string): { week?: string; weekNum?: number; body: string } {
  const match = item.match(/^(WK\d{1,2})\s+(.+)$/i);
  if (!match) return { body: item.trim() };
  return {
    week: match[1],
    weekNum: Number(match[1].replace(/^WK/i, "")),
    body: match[2].trim(),
  };
}

function bodyAlreadyListed(bodies: string[], body: string): boolean {
  return bodies.some((existing) => tasksEquivalent(existing, body) || existing === body);
}

/** 同周明细合并为一条，整体按 WK 升序排列 */
export function groupAndSortWeeklyHighlights(highlights: string[]): string[] {
  const byWeek = new Map<number, { label: string; bodies: string[] }>();
  const unlabeled: string[] = [];

  for (const raw of highlights) {
    const item = normalizeTaskHighlight(raw);
    if (!item || isNoiseTaskHighlight(item)) continue;

    const parsed = parseWeekHighlight(item);
    if (parsed.weekNum == null || !parsed.week) {
      if (!unlabeled.some((entry) => tasksEquivalent(entry, item))) {
        unlabeled.push(item);
      }
      continue;
    }

    const entry = byWeek.get(parsed.weekNum) ?? { label: parsed.week, bodies: [] };
    if (parsed.body && !bodyAlreadyListed(entry.bodies, parsed.body)) {
      entry.bodies.push(parsed.body);
    }
    byWeek.set(parsed.weekNum, entry);
  }

  const grouped = Array.from(byWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, { label, bodies }]) => `${label} ${bodies.join("；")}`);

  return [...grouped, ...unlabeled];
}

/** 规范化任务明细：拆分、去重、补全 WK 标记、按周合并排序 */
export function finalizeWeeklyHighlights(highlights: string[]): string[] {
  return groupAndSortWeeklyHighlights(
    relabelOrphanFragments(
      dedupeWeeklyHighlights(splitCombinedWeeklyHighlights(highlights))
    )
  );
}

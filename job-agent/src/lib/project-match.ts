import { mergeWeeklyHighlights, normalizeProjectName, normalizeTaskHighlight } from "./project-name";

/** 不是项目名称的周报元信息标题 */
export const NON_PROJECT_META_NAMES = new Set(["计划", "卡点"]);

const PROJECT_KEYWORDS: Record<string, string[]> = {
  "R2新品规划": ["PSM", "弹性", "雷达图", "思维拓展", "R2", "新品规划"],
  "XTS决策链路": ["XTS", "决策链路", "种草", "比选"],
  "硬件PSM": ["硬件", "ABtest", "金数据"],
  "内容PSM": ["内容PSM", "价格段"],
  "智能体搭建": ["智能体", "agent", "codex", "cursor", "评论"],
  "线下WBR": ["线下WBR", "线下调研", "WBR"],
  "产品战略分析": ["产品战略", "学而思", "讯飞", "作业帮"],
  "AI功能需求": ["AI功能", "雷达图问卷", "总结表"],
  "高价品WBR": ["高价品", "WBR"],
};

export function isNonProjectMetaName(name: string): boolean {
  return NON_PROJECT_META_NAMES.has(normalizeProjectName(name));
}

/** 判断一段文字是否描述某个项目（用于计划/卡点归属） */
export function contentMatchesProject(content: string, projectName: string): boolean {
  const text = content.trim();
  const name = normalizeProjectName(projectName);
  if (!text || !name) return false;
  if (text.includes(name)) return true;

  for (const [key, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (name.includes(key) || key.includes(name)) {
      if (keywords.some((word) => text.includes(word))) return true;
    }
  }

  const tokens = name.split(/[+&／/、\s]+/).filter((t) => t.length >= 2);
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

/** 从「计划：…——实际」行提取实际完成内容 */
export function extractPlanActualContent(line: string): string | undefined {
  const dash = line.match(/——\s*(.+)/);
  if (!dash) return undefined;
  const content = dash[1].trim();
  return content.length >= 4 ? content : undefined;
}

/** 从「卡点：…」行提取卡点描述 */
export function extractBlockerContent(line: string): string | undefined {
  const content = line.replace(/^卡点[：:]\s*/, "").trim();
  return content.length >= 4 ? content : undefined;
}

/** 在当周已解析项目中，为计划/卡点行找到最匹配的项目下标 */
export function findProjectIndexForMetaLine(
  line: string,
  entries: Array<{ projectName?: string }>,
  fallbackIndex: number
): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const name = entries[i].projectName;
    if (name && contentMatchesProject(line, name)) return i;
  }
  return fallbackIndex;
}

/** 从 orphan 计划/卡点 highlight 找到应归属的项目 */
export function findProjectIndexForOrphanHighlight<
  T extends { name: string }
>(text: string, projects: T[]): number {
  const body = text.replace(/^计划[：:]|^卡点[：:]/, "").trim();
  const actual = extractPlanActualContent(text) ?? body;
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < projects.length; i++) {
    let score = 0;
    if (contentMatchesProject(text, projects[i].name)) score += 10;
    if (contentMatchesProject(actual, projects[i].name)) score += 8;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : -1;
}

/** 移除「计划」「卡点」伪项目，并将其明细归并到具体项目 */
export function absorbNonProjectMetaCards<T extends { name: string; highlights: string[] }>(
  projects: T[]
): T[] {
  const valid = projects.filter((p) => !isNonProjectMetaName(p.name));
  const junk = projects.filter((p) => isNonProjectMetaName(p.name));
  if (!junk.length) return valid;

  const result = valid.map((p) => ({ ...p, highlights: [...(p.highlights ?? [])] }));
  let lastAbsorbTarget = -1;

  for (const card of junk) {
    for (const raw of card.highlights ?? []) {
      let content = normalizeTaskHighlight(raw);
      if (!content) continue;

      if (/^计划[：:]/i.test(content)) {
        const actual = extractPlanActualContent(content);
        if (!actual) continue;
        content = actual;
      } else if (/^卡点[：:]/i.test(content)) {
        const blocker = extractBlockerContent(content);
        if (!blocker) continue;
        content = blocker;
      }

      let idx = findProjectIndexForOrphanHighlight(raw, result);
      if (idx < 0 && isNonProjectMetaName(card.name) && card.name === "卡点" && lastAbsorbTarget >= 0) {
        idx = lastAbsorbTarget;
      }
      if (idx < 0 && result.length === 1) idx = 0;
      if (idx < 0) continue;

      lastAbsorbTarget = idx;
      result[idx].highlights = mergeWeeklyHighlights(result[idx].highlights ?? [], [content]);
    }
  }

  return result;
}

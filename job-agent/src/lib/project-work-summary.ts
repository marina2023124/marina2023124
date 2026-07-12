/** Per-task classifiers — longer / more specific patterns first. */
const TASK_CLASSIFIERS: { patterns: RegExp[]; phrase: string; order: number }[] = [
  {
    patterns: [/问卷.*更新|问卷.*测试|问卷.*编程|问卷.*链接|甄别问卷|问卷设计/i],
    phrase: "问卷设计与执行",
    order: 1,
  },
  {
    patterns: [/招募.*发布|样本招募|被访者招募/i],
    phrase: "样本招募",
    order: 2,
  },
  {
    patterns: [/深访|用户访谈|IDI|FGD|座谈会|组前.*沟通|vlog.*沟通|沉浸/i],
    phrase: "定性访谈",
    order: 3,
  },
  {
    patterns: [/tabplan|tableplan|读数|聚类|topline|贴数|tab检查|数据读数|惩罚分析/i],
    phrase: "数据处理与分析",
    order: 4,
  },
  {
    patterns: [/full report|研究报告|Keyfindings|洞察报告|报告撰写|header页/i],
    phrase: "研究报告撰写",
    order: 5,
  },
  {
    patterns: [/案头/i],
    phrase: "案头研究",
    order: 6,
  },
  {
    patterns: [/concept.*test|概念测试|可用性测试/i],
    phrase: "概念与可用性测试",
    order: 7,
  },
  {
    patterns: [/workshop|焦点小组|共创工作坊/i],
    phrase: "工作坊与共创",
    order: 8,
  },
  {
    patterns: [/项目通知书|进度表|代理培训|项目推进|通知书/i],
    phrase: "项目协调与执行",
    order: 9,
  },
  {
    patterns: [/二甄|甄别(?!问卷)/i],
    phrase: "样本甄别",
    order: 10,
  },
  {
    patterns: [/NPS|MOT|旅程地图|用户画像/i],
    phrase: "体验洞察与用户画像",
    order: 11,
  },
  {
    patterns: [/做图|制图|PPT/i],
    phrase: "可视化呈现",
    order: 12,
  },
];

/** Status / progress fragments — not deliverable work for resume summaries */
const STATUS_CLAUSE_RE =
  /^(已交接|待调研|未调研|暂不投放|暂不|实际达成|已达成|未达成|已推进|已同步|未按时达成|持续推进|待启动|暂停|因本周优先)/i;

const STATUS_ONLY_RE =
  /^(已交接|待调研|未调研|暂不投放.*|暂不.+|实际达成\d*个?|已达成|未达成|已推进|已同步|未按时达成|持续推进)([，,。.].*)?$/i;

/** Extract short action phrases from weekly task detail lines. */
const ACTION_PHRASE_RULES: { patterns: RegExp[]; phrase: string; order: number }[] = [
  { patterns: [/雷达图问卷|更新雷达图/i], phrase: "雷达图问卷迭代", order: 1 },
  { patterns: [/更新WBR|WBR/i], phrase: "WBR更新", order: 2 },
  { patterns: [/线下调研/i], phrase: "线下调研", order: 3 },
  {
    patterns: [/问卷.*投放|投放问卷|已投放问卷|ABtest问卷|周一投放/i],
    phrase: "问卷投放",
    order: 4,
  },
  { patterns: [/整理初步数据|数据整理/i], phrase: "数据整理", order: 5 },
  { patterns: [/总结表/i], phrase: "总结表更新", order: 6 },
  { patterns: [/报告.*打磨|报告待打磨|报告打磨/i], phrase: "报告打磨", order: 7 },
  { patterns: [/报告.*更新|更新.*报告|差异报告|退货报告|决策链路报告/i], phrase: "报告更新", order: 8 },
  { patterns: [/用户访问|访问\d+个|深访|退货访问|收尾访问/i], phrase: "用户访问", order: 9 },
  { patterns: [/智能体|大模型搭建|codex|评论爬取/i], phrase: "智能体搭建与分析", order: 10 },
  { patterns: [/PSM|弹性测试|弹性打磨/i], phrase: "PSM与弹性测试", order: 11 },
  { patterns: [/思维拓展|AI素养/i], phrase: "思维拓展与AI素养研究", order: 12 },
  { patterns: [/数据读数|差异分析/i], phrase: "数据分析", order: 13 },
  { patterns: [/问卷/i], phrase: "问卷工作", order: 14 },
];

function buildSummarySentence(phrases: string[]): string {
  if (phrases.length === 1) return `主要负责${phrases[0]}。`;
  if (phrases.length === 2) return `负责${phrases[0]}与${phrases[1]}。`;
  return `负责${phrases.slice(0, -1).join("、")}及${phrases[phrases.length - 1]}等工作。`;
}

function simplifyTaskLabel(task: string): string {
  let label = task
    .trim()
    .replace(/^WK\d{1,2}\s+/, "")
    .replace(/^P[0-3](?:【[^】]+】)?\s*/i, "")
    .replace(/^[-*•●\d、.．)\]]+\s*/, "")
    .replace(/^[a-z0-9\s&.-]+(?=[\u4e00-\u9fa5])/i, "")
    .trim();

  label = label
    .replace(/^(高思语文|高思小数|高思|Nabati|nabati|伊利|雀巢|玉泽)/i, "")
    .replace(/[，,]\s*(已达成|未达成|已推进|已同步|实际达成)\s*[。.]*$/gi, "")
    .replace(/[。.]{2,}/g, "。")
    .trim();

  return label || task.trim();
}

function isStatusOnlyContent(text: string): boolean {
  const bare = simplifyTaskLabel(text).replace(/[。.]+$/g, "").trim();
  if (!bare || bare.length < 4) return true;
  if (STATUS_ONLY_RE.test(bare)) return true;
  if (/^实际达成/.test(bare) && !/报告|问卷|访问|更新|投放|调研|分析|搭建|WBR/i.test(bare)) {
    return true;
  }
  return false;
}

function isStatusClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (!trimmed || trimmed.length < 4) return true;
  if (STATUS_CLAUSE_RE.test(trimmed)) return true;
  if (/^实际达成\d*个?/.test(trimmed)) return true;
  if (/^暂不投放/.test(trimmed)) return true;
  return false;
}

/** Split a task line into substantive clauses, dropping status-only fragments */
function extractWorkClauses(task: string): string[] {
  const label = simplifyTaskLabel(task);
  const parts = label
    .split(/[，,；;]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !isStatusClause(part));

  if (parts.length) return parts;

  if (!isStatusOnlyContent(label)) return [label];
  return [];
}

/** Keep only lines/clauses that describe work done, not weekly status */
export function filterTasksForSummary(tasks: string[]): string[] {
  const result: string[] = [];
  for (const task of tasks) {
    if (isStatusOnlyContent(task)) continue;
    result.push(...extractWorkClauses(task));
  }
  return result.filter((item) => item.length >= 4 && !isStatusClause(item));
}

function shortenForSummary(task: string): string {
  const label = simplifyTaskLabel(task);
  if (label.length <= 28) return label;

  const first = label.split(/[，,；;。]/)[0]?.trim() ?? label;
  if (first.length >= 4 && first.length <= 28 && !isStatusClause(first)) return first;
  return label.slice(0, 24);
}

function extractActionPhrases(tasks: string[]): string[] {
  const matched = new Map<number, string>();

  for (const task of tasks) {
    const simplified = simplifyTaskLabel(task);
    let found = false;

    for (const rule of ACTION_PHRASE_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(simplified))) {
        matched.set(rule.order, rule.phrase);
        found = true;
        break;
      }
    }

    if (!found) {
      const clause = shortenForSummary(task);
      if (
        clause.length >= 4 &&
        clause.length <= 28 &&
        /[\u4e00-\u9fa5]{2,}/.test(clause) &&
        !isStatusClause(clause) &&
        !/^(质量未达|因本周|原计划|调整为|本周主要)/.test(clause)
      ) {
        matched.set(100 + matched.size, clause);
      }
    }
  }

  return Array.from(matched.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, phrase]) => phrase)
    .filter((phrase) => !isStatusClause(phrase))
    .slice(0, 4);
}

/** Summarize a few clear Chinese task labels literally. */
function summarizeLiteralTasks(tasks: string[]): string {
  const labels = tasks
    .map(shortenForSummary)
    .filter((t) => t.length >= 4 && !isStatusClause(t));
  if (!labels.length) return "";

  const unique = Array.from(new Set(labels));
  if (unique.length === 1) return `负责${unique[0]}。`;
  if (unique.length === 2) return `负责${unique[0]}与${unique[1]}。`;
  if (unique.length <= 4) {
    return `负责${unique.slice(0, -1).join("、")}及${unique[unique.length - 1]}等工作。`;
  }
  return `负责${unique.slice(0, 3).join("、")}等研究工作。`;
}

function classifyTaskThemes(tasks: string[]): string[] {
  const matched = new Map<number, string>();

  for (const task of tasks) {
    for (const rule of TASK_CLASSIFIERS) {
      if (rule.patterns.some((pattern) => pattern.test(task))) {
        matched.set(rule.order, rule.phrase);
        break;
      }
    }
  }

  return Array.from(matched.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, phrase]) => phrase)
    .slice(0, 4);
}

/** Turn recorded task rows into one resume-ready sentence. */
export function summarizeProjectWork(tasks: string[]): string {
  const items = filterTasksForSummary(
    tasks.map((task) => task.trim()).filter((task) => task.length >= 2)
  );
  if (!items.length) return "";

  const actionPhrases = extractActionPhrases(items);
  if (actionPhrases.length > 0) {
    return buildSummarySentence(actionPhrases);
  }

  const phrases = classifyTaskThemes(items);
  if (phrases.length > 0) {
    return buildSummarySentence(phrases);
  }

  const hasChinese = items.some((task) => /[\u4e00-\u9fa5]{2,}/.test(simplifyTaskLabel(task)));
  if (hasChinese) {
    return summarizeLiteralTasks(items);
  }

  return `负责${items.length}项用户研究任务。`;
}

const METHOD_PHRASE_RULES: { re: RegExp; phrase: string }[] = [
  { re: /定性\+共创/, phrase: "定性研究与共创工作坊" },
  { re: /定性\+定量/, phrase: "定性与定量结合研究" },
  { re: /定性/, phrase: "定性研究" },
  { re: /定量/, phrase: "定量研究" },
  { re: /workshop/i, phrase: "工作坊" },
  { re: /案头/, phrase: "案头研究" },
  { re: /NPS/i, phrase: "NPS研究" },
  { re: /MOT/i, phrase: "MOT研究" },
];

function resolveMethodPhrase(method: string): string {
  const text = method.trim();
  if (!text) return "";
  for (const { re, phrase } of METHOD_PHRASE_RULES) {
    if (re.test(text)) return phrase;
  }
  return text;
}

const INDUSTRY_RE = /^(教育|食品|互联网|宠物|保健品|服饰|文旅|电器|母婴)/;
const PROJECT_ID_RE = /^\d{6,7}$|^proposal$/i;

/** Fallback summary when task rows are missing (legacy imports). */
export function summarizeProjectFromMeta(project: {
  name: string;
  description?: string;
  technologies?: string[];
}): string {
  const parts = (project.description || "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !PROJECT_ID_RE.test(part));

  const industry = parts.find((part) => INDUSTRY_RE.test(part)) || "";
  const method =
    parts.find((part) => /定性|定量|案头|共创|workshop|NPS|MOT/i.test(part)) ||
    project.technologies?.join("、") ||
    "";

  const methodPhrase = resolveMethodPhrase(method);
  const category = parts.find(
    (part) => part !== industry && part !== method && !INDUSTRY_RE.test(part)
  );

  if (category && methodPhrase) {
    return `负责${category}${methodPhrase}相关的用户研究项目。`;
  }
  if (industry && methodPhrase) {
    return `负责${industry}领域${methodPhrase}相关的用户研究项目。`;
  }
  if (methodPhrase) {
    return `主要负责${methodPhrase}相关的用户研究工作。`;
  }
  if (project.name) {
    return `负责${project.name}的用户研究项目交付。`;
  }
  return "";
}

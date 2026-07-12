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

function isReadableChineseTask(task: string): boolean {
  const label = simplifyTaskLabel(task);
  return /[\u4e00-\u9fa5]{2,}/.test(label) && label.length <= 20;
}

/** Summarize a few clear Chinese task labels literally. */
function summarizeLiteralTasks(tasks: string[]): string {
  const labels = tasks.map(simplifyTaskLabel).filter((t) => t.length >= 2);
  if (!labels.length) return "";

  if (labels.length === 1) return `负责${labels[0]}。`;
  if (labels.length === 2) return `负责${labels[0]}与${labels[1]}。`;
  if (labels.length <= 5) {
    return `负责${labels.slice(0, -1).join("、")}及${labels[labels.length - 1]}等工作。`;
  }
  return `负责${labels.slice(0, 3).join("、")}等${labels.length}项研究工作。`;
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
  const items = tasks.map((task) => task.trim()).filter((task) => task.length >= 2);
  if (!items.length) return "";

  const chineseTasks = items.filter(isReadableChineseTask);
  const mostlyChinese = chineseTasks.length >= items.length * 0.6;

  // Few clear Chinese tasks → use actual task names (most accurate)
  if (items.length <= 5 && mostlyChinese && chineseTasks.length === items.length) {
    return summarizeLiteralTasks(items);
  }

  const phrases = classifyTaskThemes(items);
  if (phrases.length > 0) {
    return buildSummarySentence(phrases);
  }

  if (mostlyChinese) {
    return summarizeLiteralTasks(chineseTasks);
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

const WORK_THEME_RULES: {
  patterns: RegExp[];
  phrase: string;
  order: number;
}[] = [
  {
    patterns: [/问卷|招募|甄别|二甄|编程|QC|链接测试|测试反馈/i],
    phrase: "问卷设计与执行",
    order: 1,
  },
  {
    patterns: [/深访|访谈|FGD|IDI|组前|vlog|沉浸|座谈会|FW|notes/i],
    phrase: "定性访谈与座谈会",
    order: 2,
  },
  {
    patterns: [
      /tabplan|tableplan|读数|聚类|topline|贴数|tab|SA|数据|惩罚|语法|检查|标注|读数/i,
    ],
    phrase: "数据处理与分析",
    order: 3,
  },
  {
    patterns: [/report|报告|Keyfindings|洞察|撰写|汇报|header页/i],
    phrase: "研究报告撰写",
    order: 4,
  },
  {
    patterns: [/案头|desk|资料整理|整理内容/i],
    phrase: "案头研究",
    order: 5,
  },
  {
    patterns: [/concept|概念测试|可用性/i],
    phrase: "概念与可用性测试",
    order: 6,
  },
  {
    patterns: [/workshop|培训|共创|做图|制图/i],
    phrase: "工作坊与可视化",
    order: 7,
  },
  {
    patterns: [/NPS|MOT|旅程|画像|UA/i],
    phrase: "体验洞察与用户画像",
    order: 8,
  },
];

function buildSummarySentence(phrases: string[]): string {
  if (phrases.length === 1) return `主要负责${phrases[0]}。`;
  if (phrases.length === 2) return `负责${phrases[0]}与${phrases[1]}。`;
  return `负责${phrases.slice(0, -1).join("、")}及${phrases[phrases.length - 1]}等工作。`;
}

function cleanTaskLabel(task: string): string {
  return task
    .replace(/^[a-z]+/i, "")
    .replace(/[-_]/g, "")
    .trim();
}

/** Turn recorded task rows into one resume-ready sentence. */
export function summarizeProjectWork(tasks: string[]): string {
  const items = tasks.map((task) => task.trim()).filter((task) => task.length >= 2);
  if (!items.length) return "";

  const matched = new Map<number, string>();
  for (const rule of WORK_THEME_RULES) {
    const hit = items.some((task) => rule.patterns.some((pattern) => pattern.test(task)));
    if (hit) matched.set(rule.order, rule.phrase);
  }

  const phrases = Array.from(matched.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, phrase]) => phrase)
    .slice(0, 4);

  if (phrases.length > 0) {
    return buildSummarySentence(phrases);
  }

  const fallback = items
    .slice(0, 2)
    .map(cleanTaskLabel)
    .filter((task) => task.length >= 2);

  if (!fallback.length) {
    return `负责${items.length}项用户研究任务。`;
  }

  return items.length <= 2
    ? `负责${fallback.join("与")}。`
    : `负责${fallback.join("、")}等${items.length}项研究任务。`;
}

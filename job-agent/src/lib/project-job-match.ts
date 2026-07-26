import type { JobPosting, MatchedProject, Profile, Project } from "./types";
import type { JobCriterion } from "./job-criteria";
import { getProjectWorkItems, getProjectWorkSummary } from "./utils";
import { getProjectTextBlob } from "./matching-shared";
import {
  findWorkExperienceForProject,
  formatWorkExperienceTag,
  getWorkExperienceLabel,
} from "./project-work-link";

/** 几乎所有用研项目都会出现的词 —— 不能作为匹配理由 */
const GENERIC_UR_TERMS = new Set([
  "用户研究",
  "用研",
  "调研",
  "访谈",
  "深访",
  "问卷",
  "定性",
  "定量",
  "报告",
  "研究报告",
  "洞察",
  "分析",
  "研究",
  "能力",
  "方法",
  "项目",
  "相关",
  "经验",
  "工作",
  "负责",
  "完成",
  "进行",
  "开展",
  "更新",
  "迭代",
  "数据",
  "数据分析",
  "用户",
  "客户",
  "需求",
  "方案",
  "总结",
  "整理",
  "设计",
  "执行",
  "投放",
  "回收",
  "样本",
  "被访",
  "纪要",
  "表格",
  "沟通",
  "协调",
  "推进",
  "撰写",
  "输出",
  "交付",
  "业务",
  "场景",
  "内容",
  "功能",
  "测试",
  "检查",
  "确认",
  "准备",
  "跟进",
  "反馈",
  "优化",
  "提升",
  "支持",
  "协助",
  "参与",
  "配合",
  "日常",
  "定期",
  "每周",
  "本周",
  "任务",
  "事项",
  "工作项",
  "商业化",
]);

/** JD 中值得对齐的「岗位特殊性」信号 */
const JD_SIGNAL_PATTERNS: { label: string; keywords: RegExp; resumeHint: string }[] = [
  { label: "社媒聆听", keywords: /社媒聆听|社交媒体|舆情|声量/i, resumeHint: "社媒/舆情类研究" },
  { label: "品牌声誉", keywords: /品牌声誉|品牌形象|品牌认知|品牌健康/i, resumeHint: "品牌声誉研究" },
  { label: "消费者洞察", keywords: /消费者洞察|消费洞察|用户洞察|人群洞察/i, resumeHint: "消费者洞察" },
  { label: "营销效果", keywords: /营销效果|投放效果|广告效果|ROI|转化/i, resumeHint: "营销效果评估" },
  { label: "品牌营销", keywords: /品牌营销|品牌传播|品牌策略|品牌定位|品牌/i, resumeHint: "品牌营销研究" },
  { label: "快消零售", keywords: /快消|零售|FMCG|消费品类|食品|饮料/i, resumeHint: "快消/零售品类" },
  { label: "新品规划", keywords: /新品|上市|产品规划|概念测试|产品线/i, resumeHint: "新品/产品规划" },
  { label: "安全合规", keywords: /安全合规|合规|风控|隐私|内容安全/i, resumeHint: "安全合规研究" },
  { label: "电商交易", keywords: /电商|购物|交易|退货|履约|GMV/i, resumeHint: "电商/交易场景" },
  { label: "B端企业", keywords: /to\s*b|tob|B端|企业客户|SaaS|企业服务/i, resumeHint: "B端/企业服务" },
  { label: "AI工具应用", keywords: /agent|AI工具|大模型|deepseek|豆包|智能体/i, resumeHint: "AI辅助研究/分析" },
  { label: "数据运营", keywords: /数据运营|数据敏感|数据挖掘|大数据/i, resumeHint: "数据运营分析" },
  { label: "PPT汇报", keywords: /PPT|演示|汇报|提案/i, resumeHint: "研究汇报与提案" },
  { label: "Excel分析", keywords: /\bexcel\b/i, resumeHint: "Excel数据处理" },
  { label: "统计软件", keywords: /SPSS|Stata|SQL|Python|R语言/i, resumeHint: "统计分析" },
  { label: "咨询框架", keywords: /研究框架|研究方案|咨询|框架思维|逻辑框架/i, resumeHint: "研究框架设计" },
  { label: "内容社区", keywords: /内容社区|社区产品|UGC|创作者|笔记|种草|主站/i, resumeHint: "内容社区研究" },
  { label: "短视频", keywords: /短视频|视频消费|视频内容|消费体验/i, resumeHint: "短视频/内容消费研究" },
];

/** 岗位标题【方向】→ 可写入简历的对齐维度（比泛化「商业化」更具体） */
const DIRECTION_SIGNALS: Record<string, { label: string; keywords: RegExp; resumeHint: string }> = {
  商业化: {
    label: "商业化业务研究",
    keywords: /商业化|广告|投放|变现|广告主|营销效果|商业分析|ROI|收入/i,
    resumeHint: "商业化/广告研究",
  },
  安全合规: {
    label: "安全合规研究",
    keywords: /安全合规|合规|风控|隐私|审核|举报|内容安全|风险/i,
    resumeHint: "安全合规研究",
  },
  直播: {
    label: "直播业务研究",
    keywords: /直播|主播|打赏|带货|短视频/i,
    resumeHint: "直播/短视频研究",
  },
  电商: {
    label: "电商业务研究",
    keywords: /电商|购物|交易|退货|履约|GMV|SKU/i,
    resumeHint: "电商交易研究",
  },
  主站: {
    label: "主站产品研究",
    keywords: /主站|内容社区|短视频|创作|消费体验|推荐|feed|社交|社区/i,
    resumeHint: "主站/内容产品研究",
  },
};

interface JobSignals {
  direction: string | null;
  roleTitle: string;
  blob: string;
  signals: { label: string; resumeHint: string; keywords: RegExp }[];
  distinctiveTerms: string[];
  responsibilityLines: string[];
  requiredTools: string[];
}

interface ProjectSignals {
  summary: string;
  workItems: string[];
  blob: string;
  name: string;
  clientOrBrand: string | null;
  industryTags: string[];
  distinctiveTerms: string[];
}

interface MatchEvidence {
  specificity: number;
  reason: string;
}

function extractDirection(title: string): string | null {
  const bracket = title.match(/【([^】]+)】/);
  return bracket ? bracket[1].trim() : null;
}

function stripWeekLabel(text: string): string {
  return text.replace(/^WK\d{1,2}\s*/i, "").trim();
}

function extractChineseTerms(text: string): string[] {
  return text.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
}

function isGenericTerm(term: string): boolean {
  return GENERIC_UR_TERMS.has(term) || term.length < 2;
}

function extractDistinctiveTerms(text: string, extraStop = new Set<string>()): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of extractChineseTerms(text)) {
    if (isGenericTerm(term) || extraStop.has(term) || seen.has(term)) continue;
    seen.add(term);
    result.push(term);
  }
  return result;
}

function buildJobSignals(job: JobPosting): JobSignals {
  const blob = [
    job.title,
    job.description,
    ...(job.requirements ?? []),
    ...(job.responsibilities ?? []),
    ...(job.preferredSkills ?? []),
  ].join("\n");

  const direction = extractDirection(job.title);
  const signals = JD_SIGNAL_PATTERNS.filter((s) => s.keywords.test(blob));

  if (direction) {
    for (const [key, dirSignal] of Object.entries(DIRECTION_SIGNALS)) {
      if (direction.includes(key) && !signals.some((s) => s.label === dirSignal.label)) {
        signals.unshift(dirSignal);
      }
    }
  }

  const responsibilityLines = (job.responsibilities ?? [])
    .concat(splitLines(job.description))
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && l.length <= 100);

  const roleTerms = extractDistinctiveTerms(job.title.replace(/[（(].*[）)]/g, ""));
  const reqTerms = extractDistinctiveTerms(
    [...(job.requirements ?? []), ...(job.responsibilities ?? [])].join(" ")
  );
  const distinctiveTerms = Array.from(new Set([...roleTerms, ...reqTerms])).slice(0, 40);

  const requiredTools: string[] = [];
  if (/excel/i.test(blob)) requiredTools.push("Excel");
  if (/spss/i.test(blob)) requiredTools.push("SPSS");
  if (/sql/i.test(blob)) requiredTools.push("SQL");
  if (/python/i.test(blob)) requiredTools.push("Python");
  if (/agent|AI|大模型|deepseek|豆包/i.test(blob)) requiredTools.push("AI工具");

  return {
    direction,
    roleTitle: job.title,
    blob,
    signals,
    distinctiveTerms,
    responsibilityLines,
    requiredTools,
  };
}

function splitLines(text: string): string[] {
  return text
    .split(/[\n；;。]|(?=\d+[、.])/)
    .map((s) => s.replace(/^\d+[、.．)\]]\s*/, "").trim())
    .filter(Boolean);
}

const CLIENT_IN_NAME_RE =
  /^(百度|阿里|腾讯|字节|快手|美团|京东|伊利|雀巢|可口可乐|宝洁|联合利华|玛氏|亿滋|欧莱雅|兰蔻|华为|小米|OPPO|vivo|网易|新浪|搜狐|滴滴|小红书|B站|哔哩|知乎|微博|抖音|淘宝|天猫|拼多多|苏宁|格力|海尔|美的|比亚迪|特斯拉|奔驰|宝马|奥迪|大众|丰田|本田|耐克|阿迪|星巴克|麦当劳|肯德基|沃尔玛|家乐福|屈臣氏|无印|MUJI|宜家|ZARA|H&M|优衣库|名创|瑞幸|喜茶|奈雪|元气森林|三顿半|完美日记|花西子|李佳琦|薇娅|.datastory|数说|百度百科|百科)/i;

const KNOWN_PLATFORM_BRANDS =
  /小红书|抖音|快手|B站|哔哩|哔哩哔哩|微博|知乎|视频号|豆瓣|头条|西瓜/i;

const INDUSTRY_FROM_PROJECT: { label: string; keywords: RegExp }[] = [
  { label: "快消食品", keywords: /伊利|雀巢|可乐|玛氏|亿滋|食品|饮料|乳品|零食|餐饮|端午|春节|中秋/i },
  { label: "互联网品牌", keywords: /百度|阿里|腾讯|字节|快手|美团|京东|互联网|平台|APP|小程序/i },
  { label: "内容社区平台", keywords: /小红书|抖音|B站|哔哩|微博|知乎|视频号|社区|种草|笔记|创作者|UGC/i },
  { label: "AI产品", keywords: /AI|智能体|agent|大模型|算法|功能需求|XTS/i },
  { label: "汽车出行", keywords: /汽车|出行|车联网|新能源|驾驶/i },
  { label: "3C数码", keywords: /手机|数码|3C|硬件|电子/i },
  { label: "美妆护肤", keywords: /美妆|护肤|化妆品|欧莱雅|兰蔻|医美/i },
];

function inferClientOrBrand(project: Project): string | null {
  const blob = `${project.name} ${project.description}`;
  const brandMatch = blob.match(KNOWN_PLATFORM_BRANDS);
  if (brandMatch) {
    const brand = brandMatch[0];
    return brand === "哔哩哔哩" || brand === "哔哩" ? "B站" : brand;
  }

  const name = project.name.trim();
  const m = name.match(CLIENT_IN_NAME_RE);
  if (m) return m[1] ?? name.split(/[\s·\-—]/)[0];

  for (const { keywords } of INDUSTRY_FROM_PROJECT) {
    const hit = blob.match(keywords);
    if (hit) return hit[0];
  }
  return null;
}

function buildProjectSignals(project: Project): ProjectSignals {
  const workItems = getProjectWorkItems(project).map(stripWeekLabel).filter(Boolean);
  const summary = getProjectWorkSummary(project);
  const blob = [project.name, project.description, summary, ...workItems].join(" ");
  const industryTags = INDUSTRY_FROM_PROJECT.filter((i) => i.keywords.test(blob)).map((i) => i.label);

  return {
    summary: summary || project.description || "暂无成果描述",
    workItems,
    blob,
    name: project.name,
    clientOrBrand: inferClientOrBrand(project),
    industryTags,
    distinctiveTerms: extractDistinctiveTerms(blob),
  };
}

function computeTermFrequency(profile: Profile): Map<string, number> {
  const freq = new Map<string, number>();
  for (const project of profile.projects) {
    const terms = new Set(extractDistinctiveTerms(getProjectTextBlob(project)));
    for (const t of Array.from(terms)) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return freq;
}

function isRareTerm(term: string, freq: Map<string, number>, total: number): boolean {
  const count = freq.get(term) ?? 0;
  return count <= Math.max(1, Math.ceil(total * 0.4));
}

function shorten(text: string, max = 36): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function findWorkItemEvidence(workItems: string[], pattern: RegExp): string | null {
  for (const item of workItems) {
    if (pattern.test(item)) return shorten(item);
  }
  return null;
}

function matchJobSignals(
  jobSignals: JobSignals,
  project: ProjectSignals
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];

  for (const signal of jobSignals.signals) {
    if (!signal.keywords.test(project.blob)) continue;

    const workEvidence = findWorkItemEvidence(project.workItems, signal.keywords);
    const nameHit = signal.keywords.test(project.name);

    if (workEvidence) {
      evidence.push({
        specificity: 32,
        reason: `JD 核心要求「${signal.label}」，项目中「${workEvidence}」为同类工作，可写进简历`,
      });
    } else if (nameHit) {
      evidence.push({
        specificity: 26,
        reason: `项目「${shorten(project.name, 24)}」聚焦${signal.resumeHint}，与 JD「${signal.label}」方向一致`,
      });
    } else if (signal.keywords.test(project.summary)) {
      evidence.push({
        specificity: 22,
        reason: `项目成果涉及${signal.resumeHint}，对应 JD 强调的「${signal.label}」`,
      });
    } else if (signal.keywords.test(project.blob)) {
      const term = findDistinctiveOverlap(project, signal.keywords);
      if (term) {
        evidence.push({
          specificity: 20,
          reason: `项目涉及${signal.resumeHint}（${term}），与 JD「${signal.label}」相关`,
        });
      }
    }
  }

  return evidence;
}

function findDistinctiveOverlap(project: ProjectSignals, pattern: RegExp): string | null {
  for (const term of project.distinctiveTerms) {
    if (pattern.test(term)) return term;
  }
  const m = project.blob.match(pattern);
  if (m) {
    const hit = m[0];
    if (!isGenericTerm(hit)) return hit;
  }
  return null;
}

function isContentPlatformJob(job: JobPosting, jobSignals: JobSignals): boolean {
  const text = [job.title, jobSignals.blob].join("\n");
  return /主站|内容社区|短视频|视频|社区|创作|feed|UGC|快手/i.test(text);
}

/** 快手主站 ↔ 小红书/抖音等同类内容平台项目 */
function matchContentPlatformAlignment(
  job: JobPosting,
  jobSignals: JobSignals,
  project: ProjectSignals
): MatchEvidence[] {
  if (!isContentPlatformJob(job, jobSignals)) return [];

  const platformRe = /小红书|抖音|B站|哔哩|微博|知乎|视频号|种草|笔记|创作者|社区|UGC|Feed/i;
  if (!platformRe.test(project.blob)) return [];

  const snippet =
    findWorkItemEvidence(project.workItems, platformRe) ?? shorten(project.name, 28);
  const client = project.clientOrBrand;
  const targetCompany = job.company?.trim();

  if (client === "小红书" && targetCompany === "快手") {
    return [
      {
        specificity: 42,
        reason: `JD 为快手主站/内容社区方向，项目服务「小红书」同类内容平台，产品形态与用户场景高度对标，建议重点写入`,
      },
    ];
  }

  if (client && /小红书|抖音|B站|微博|知乎/.test(client)) {
    return [
      {
        specificity: 38,
        reason: `JD 强调内容社区/短视频，项目客户「${client}」为同类平台研究，与「${jobSignals.direction ?? "主站"}」方向一致`,
      },
    ];
  }

  return [
    {
      specificity: 32,
      reason: `JD 要求内容社区相关能力，项目「${snippet}」涉及内容平台/社区用户研究`,
    },
  ];
}

function matchIndustryAndClient(
  jobSignals: JobSignals,
  project: ProjectSignals
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];

  for (const signal of jobSignals.signals) {
    if (/快消|零售|品牌|消费/i.test(signal.label)) {
      for (const tag of project.industryTags) {
        if (
          (signal.label.includes("快消") && tag.includes("快消")) ||
          (signal.label.includes("品牌") && /品牌|互联网/.test(tag))
        ) {
          const client = project.clientOrBrand ?? shorten(project.name, 20);
          evidence.push({
            specificity: 28,
            reason: `JD 要求${signal.label}背景，项目服务「${client}」（${tag}），行业匹配度高`,
          });
        }
      }
    }

    if (/内容社区|短视频|主站/.test(signal.label)) {
      const isPlatformProject =
        project.industryTags.includes("内容社区平台") ||
        Boolean(project.clientOrBrand && /小红书|抖音|B站|微博|知乎|快手/.test(project.clientOrBrand));
      if (isPlatformProject) {
        const client = project.clientOrBrand ?? shorten(project.name, 20);
        evidence.push({
          specificity: 34,
          reason: `JD 核心要求「${signal.label}」，项目服务「${client}」（内容社区平台），与岗位产品方向高度相关`,
        });
      }
    }
  }

  if (project.clientOrBrand) {
    for (const term of jobSignals.distinctiveTerms) {
      if (term.length >= 2 && project.blob.includes(term) && project.clientOrBrand.includes(term)) {
        evidence.push({
          specificity: 24,
          reason: `JD 提及「${term}」，项目客户/品类为「${project.clientOrBrand}」，可直接对标写入`,
        });
        break;
      }
    }
  }

  return evidence;
}

function matchResponsibilitySpecificity(
  jobSignals: JobSignals,
  project: ProjectSignals,
  termFreq: Map<string, number>,
  totalProjects: number
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];

  for (const jdLine of jobSignals.responsibilityLines) {
    const jdSpecific = extractDistinctiveTerms(jdLine).filter(
      (t) => isRareTerm(t, termFreq, totalProjects) || jdLine.includes(t)
    );
    if (jdSpecific.length === 0) continue;

    for (const item of project.workItems) {
      const matchedTerms = jdSpecific.filter((t) => item.includes(t) || project.name.includes(t));
      if (matchedTerms.length >= 1) {
        const jdShort = shorten(jdLine, 40);
        evidence.push({
          specificity: 20 + matchedTerms.length * 8,
          reason: `JD 职责「${jdShort}」↔ 项目「${shorten(item)}」（共同点：${matchedTerms.slice(0, 3).join("、")}）`,
        });
        break;
      }
    }
  }

  return evidence;
}

function isUserResearchJob(job: JobPosting): boolean {
  const text = [job.title, job.description, ...(job.requirements ?? [])].join("\n");
  return /用户研究|用研|UX研究|User\s*Research|研究员/i.test(text);
}

/** 用研岗位：从 JD 方法论要求 ↔ 项目具体交付 做二次匹配（避免只剩工具类命中） */
function matchUrMethodologyAlignment(
  jobSignals: JobSignals,
  project: ProjectSignals
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];
  const pairs: { jd: RegExp; label: string; project: RegExp }[] = [
    { jd: /定性|深访|访谈|焦点小组|\bFG\b/i, label: "定性研究", project: /深访|访谈|FG|焦点|定性|可用性|走查/i },
    { jd: /定量|问卷|样本|调研/i, label: "定量研究", project: /问卷|定量|投放|回收|读数|统计/i },
    { jd: /报告|洞察|汇报|输出|落地|推动/i, label: "研究交付", project: /报告|洞察|汇报|输出|结论|提案/i },
    { jd: /独立|全流程|设计.*执行|端到端/i, label: "独立项目", project: /负责|独立|全流程|设计|执行|主导/i },
    { jd: /用户研究|用研|用户体验/i, label: "用户研究", project: /用户|用研|需求|体验|测试|画像/i },
  ];

  for (const pair of pairs) {
    if (!pair.jd.test(jobSignals.blob)) continue;
    const snippet = findWorkItemEvidence(project.workItems, pair.project);
    if (!snippet || snippet.length < 4) continue;
    evidence.push({
      specificity: 26,
      reason: `JD 要求${pair.label}，项目中「${snippet}」为同类交付，可写进简历`,
    });
  }

  return evidence;
}

function matchTargetCompany(job: JobPosting, project: ProjectSignals): MatchEvidence[] {
  const company = job.company?.trim();
  if (!company || company.length < 2) return [];
  if (!project.blob.includes(company) && !project.name.includes(company)) return [];

  const snippet =
    findWorkItemEvidence(project.workItems, new RegExp(company)) ??
    shorten(project.name, 24);
  return [
    {
      specificity: 34,
      reason: `目标公司「${company}」，项目「${snippet}」直接相关，建议重点写入`,
    },
  ];
}

function matchRequiredTools(
  jobSignals: JobSignals,
  project: ProjectSignals
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];
  const toolRes: Record<string, RegExp> = {
    Excel: /excel|透视表|vlookup|表格处理/i,
    SPSS: /spss/i,
    SQL: /\bsql\b|数据读数|大样本/i,
    Python: /python/i,
    AI工具: /agent|AI|智能体|deepseek|豆包|大模型/i,
  };

  for (const tool of jobSignals.requiredTools) {
    const re = toolRes[tool];
    if (!re) continue;
    const snippet = findWorkItemEvidence(project.workItems, re) ?? (re.test(project.blob) ? project.summary : null);
    if (snippet) {
      evidence.push({
        specificity: 30,
        reason: `JD 要求${tool}，项目中有「${shorten(String(snippet), 30)}」实践 — 可弥补技能差距`,
      });
    }
  }

  return evidence;
}

function matchRoleTitleAlignment(jobSignals: JobSignals, project: ProjectSignals): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];
  const roleTerms = extractDistinctiveTerms(jobSignals.roleTitle.replace(/分析师|专员|经理|顾问/g, ""));

  for (const term of roleTerms) {
    if (term.length < 2) continue;
    if (project.name.includes(term) || project.blob.includes(term)) {
      evidence.push({
        specificity: 18,
        reason: `岗位为「${jobSignals.roleTitle}」，项目涉及「${term}」相关课题，岗位对口`,
      });
      break;
    }
  }

  if (jobSignals.direction) {
    const dirWords = extractDistinctiveTerms(jobSignals.direction);
    const hits = dirWords.filter((w) => project.blob.includes(w));
    if (hits.length > 0) {
      const snippet = findWorkItemEvidence(project.workItems, new RegExp(hits.join("|"))) ?? hits[0];
      evidence.push({
        specificity: 25,
        reason: `岗位方向「${jobSignals.direction}」，项目工作含「${snippet}」，方向契合`,
      });
    }
  }

  return evidence;
}

function dedupeEvidence(items: MatchEvidence[]): MatchEvidence[] {
  const seen = new Set<string>();
  const seenSignals = new Set<string>();
  const result: MatchEvidence[] = [];
  for (const item of items.sort((a, b) => b.specificity - a.specificity)) {
    const signalKey = item.reason.match(/JD[^「]*「([^」]+)」/)?.[1] ?? item.reason.slice(0, 20);
    if (seenSignals.has(signalKey)) continue;
    const key = item.reason.slice(0, 24);
    if (seen.has(key)) continue;
    seen.add(key);
    seenSignals.add(signalKey);
    result.push(item);
  }
  return result;
}

function isGenericReason(reason: string): boolean {
  return (
    /用户研究能力|定性\s*\/\s*定量|研究方法与 JD 一致|用户研究项目|涉及 用户研究/i.test(reason) ||
    /对应 JD「用户研究能力」/i.test(reason) ||
    (/研究报告|数据分析|定量问卷/.test(reason) && !/JD/.test(reason))
  );
}

function scoreProjectForJob(
  project: Project,
  projectCtx: ProjectSignals,
  jobCtx: JobSignals,
  job: JobPosting,
  termFreq: Map<string, number>,
  totalProjects: number,
  options?: { relaxed?: boolean }
): { specificity: number; reasons: string[] } | null {
  const urExtra = isUserResearchJob(job)
    ? [
        ...matchUrMethodologyAlignment(jobCtx, projectCtx),
        ...matchTargetCompany(job, projectCtx),
        ...matchContentPlatformAlignment(job, jobCtx, projectCtx),
      ]
    : matchContentPlatformAlignment(job, jobCtx, projectCtx);

  const allEvidence = dedupeEvidence([
    ...matchJobSignals(jobCtx, projectCtx),
    ...matchIndustryAndClient(jobCtx, projectCtx),
    ...matchResponsibilitySpecificity(jobCtx, projectCtx, termFreq, totalProjects),
    ...matchRequiredTools(jobCtx, projectCtx),
    ...matchRoleTitleAlignment(jobCtx, projectCtx),
    ...urExtra,
  ]).filter((e) => !isGenericReason(e.reason));

  if (allEvidence.length === 0) return null;

  const specificity = allEvidence.reduce((sum, e) => sum + e.specificity, 0);
  const minSpecificity = options?.relaxed ? 18 : 22;

  if (specificity < minSpecificity) return null;

  const uniqueReasons: string[] = [];
  const usedSnippets = new Set<string>();
  for (const e of allEvidence) {
    const snips = e.reason.match(/「([^」]+)」/g) ?? [];
    const anchor = snips.length > 0 ? snips[snips.length - 1]! : e.reason.slice(0, 30);
    if (usedSnippets.has(anchor)) continue;
    usedSnippets.add(anchor);
    uniqueReasons.push(e.reason);
    if (uniqueReasons.length >= 2) break;
  }

  return {
    specificity,
    reasons: uniqueReasons,
  };
}

function resolveWorkExperience(
  project: Project,
  profile: Profile
): { workExperienceId?: string; workExperienceLabel: string } {
  if (project.workExperienceId) {
    const label = getWorkExperienceLabel(project.workExperienceId, profile.workExperiences);
    if (label) {
      return { workExperienceId: project.workExperienceId, workExperienceLabel: label };
    }
  }

  const matched = findWorkExperienceForProject(project, profile.workExperiences);
  if (matched) {
    return {
      workExperienceId: matched.id,
      workExperienceLabel: formatWorkExperienceTag(matched),
    };
  }

  return { workExperienceLabel: "未关联工作" };
}

const PER_WORK_MATCH_LIMIT = 4;
const GLOBAL_MATCH_LIMIT = 12;
const MIN_TOTAL_MATCHES = 4;

function isLowValueInternalProject(project: Project): boolean {
  return /内部|流程优化|模板|提纲|日常维护|行政/i.test(project.name);
}

function scoreAllProjectsForJob(
  profile: Profile,
  job: JobPosting,
  jobCtx: JobSignals,
  termFreq: Map<string, number>,
  totalProjects: number,
  options?: { relaxed?: boolean }
): (MatchedProject & { specificity: number })[] {
  const results: (MatchedProject & { specificity: number })[] = [];

  for (const project of profile.projects) {
    if (isLowValueInternalProject(project)) continue;
    const projectCtx = buildProjectSignals(project);
    const scored = scoreProjectForJob(
      project,
      projectCtx,
      jobCtx,
      job,
      termFreq,
      totalProjects,
      options
    );
    if (!scored) continue;

    const work = resolveWorkExperience(project, profile);

    results.push({
      id: project.id,
      name: project.name,
      summary: projectCtx.summary,
      reasons: scored.reasons,
      workExperienceLabel: work.workExperienceLabel,
      workExperienceId: work.workExperienceId,
      specificity: scored.specificity,
    });
  }

  return results;
}

/** 按工作经历分组取 Top 项目，避免最近一份工作占满全部名额 */
export function selectMatchedProjectsByWorkExperience(
  scored: (MatchedProject & { specificity: number })[],
  profile: Profile
): MatchedProject[] {
  const byWork = new Map<string, (MatchedProject & { specificity: number })[]>();

  for (const item of scored) {
    const label = item.workExperienceLabel || "未关联工作";
    const list = byWork.get(label) ?? [];
    const existing = list.find((p) => p.id === item.id);
    if (existing) {
      if (item.specificity > existing.specificity) {
        byWork.set(
          label,
          list.map((p) => (p.id === item.id ? item : p))
        );
      }
      continue;
    }
    list.push(item);
    byWork.set(label, list);
  }

  const merged: MatchedProject[] = [];
  const usedLabels = new Set<string>();

  for (const exp of profile.workExperiences) {
    const label = formatWorkExperienceTag(exp);
    usedLabels.add(label);
    const list = (byWork.get(label) ?? [])
      .sort((a, b) => b.specificity - a.specificity || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, PER_WORK_MATCH_LIMIT);

    for (const { specificity, ...rest } of list) {
      void specificity;
      merged.push(rest);
    }
  }

  for (const [label, list] of Array.from(byWork.entries())) {
    if (usedLabels.has(label)) continue;
    const top = list
      .sort((a, b) => b.specificity - a.specificity || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, PER_WORK_MATCH_LIMIT);
    for (const { specificity, ...rest } of top) {
      void specificity;
      merged.push(rest);
    }
  }

  return merged.slice(0, GLOBAL_MATCH_LIMIT);
}

const CONTENT_PLATFORM_PROJECT_RE =
  /小红书|抖音|B站|哔哩|微博|知乎|视频号|种草|笔记|创作者|社媒|内容社区|UGC/i;

/** 项目是否涉及内容平台 / 社媒（用于快手主站等岗位强制保留） */
export function isContentPlatformProject(project: Project): boolean {
  const blob = [
    project.name,
    project.description,
    getProjectWorkSummary(project),
    ...getProjectWorkItems(project),
  ].join(" ");
  return CONTENT_PLATFORM_PROJECT_RE.test(blob);
}

function ensureContentPlatformProjectsIncluded(
  selected: MatchedProject[],
  scored: (MatchedProject & { specificity: number })[],
  job: JobPosting,
  jobCtx: JobSignals
): MatchedProject[] {
  if (!isContentPlatformJob(job, jobCtx)) return selected;

  const hasPlatform = selected.some((item) => CONTENT_PLATFORM_PROJECT_RE.test(item.name));
  if (hasPlatform) return selected;

  const platformCandidate = scored
    .filter((item) => CONTENT_PLATFORM_PROJECT_RE.test(item.name))
    .sort((a, b) => b.specificity - a.specificity)[0];

  if (!platformCandidate) return selected;

  const { specificity, ...rest } = platformCandidate;
  void specificity;
  return [rest, ...selected].slice(0, GLOBAL_MATCH_LIMIT);
}

export function findMatchedProjectsDetailed(
  profile: Profile,
  job: JobPosting,
  criteria?: JobCriterion[]
): MatchedProject[] {
  void criteria;
  const jobCtx = buildJobSignals(job);
  const termFreq = computeTermFrequency(profile);
  const totalProjects = profile.projects.length || 1;

  let results = scoreAllProjectsForJob(profile, job, jobCtx, termFreq, totalProjects);

  let selected = selectMatchedProjectsByWorkExperience(results, profile);

  const minTarget = Math.max(MIN_TOTAL_MATCHES, profile.workExperiences.length * 2);
  if (selected.length < minTarget && isUserResearchJob(job)) {
    const coveredIds = new Set(results.map((p) => p.id));
    const relaxed = scoreAllProjectsForJob(profile, job, jobCtx, termFreq, totalProjects, {
      relaxed: true,
    }).filter((p) => !coveredIds.has(p.id));

    if (relaxed.length > 0) {
      results = [...results, ...relaxed];
      selected = selectMatchedProjectsByWorkExperience(results, profile);
    }
  }

  return ensureContentPlatformProjectsIncluded(selected, results, job, jobCtx);
}

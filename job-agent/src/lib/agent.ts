import type { AppData, ChatMessage, Profile } from "./types";
import { matchAllJobs } from "./matching";
import { calcTotalExperienceYears, generateId } from "./utils";

type AgentIntent =
  | "greeting"
  | "experience_guide"
  | "skill_analysis"
  | "job_recommend"
  | "resume_summary"
  | "interview_prep"
  | "general";

function detectIntent(message: string): AgentIntent {
  const m = message.toLowerCase();
  if (/你好|您好|hello|hi|开始/.test(m)) return "greeting";
  if (/经历|工作经验|梳理|整理|star|成就/.test(m)) return "experience_guide";
  if (/技能|能力|优势|短板|分析/.test(m)) return "skill_analysis";
  if (/推荐|匹配|岗位|职位|找工作|投递/.test(m)) return "job_recommend";
  if (/简历|summary|总结|概述/.test(m)) return "resume_summary";
  if (/面试|准备|问题/.test(m)) return "interview_prep";
  return "general";
}

function buildExperienceGuide(profile: Profile): string {
  const expCount = profile.workExperiences.length;
  if (expCount === 0) {
    return `我来帮你梳理工作经历。请按以下结构逐一填写：

**第一步：基本信息**
- 姓名、联系方式
- 一句话职业定位（如「3年前端开发，专注 React 生态」）

**第二步：每段工作经历（STAR 法则）**
- **S** 情境：在什么背景下？
- **T** 任务：负责什么？
- **A** 行动：具体做了什么？
- **R** 结果：取得了什么量化成果？（如「性能提升 40%」「用户增长 2 万」）

你可以直接告诉我一段经历，我帮你整理成结构化内容。例如：
「我在 XX 公司做前端，负责电商后台重构，用 React 重写老系统，页面加载从 5s 降到 1.2s」`;
  }

  const latest = profile.workExperiences[0];
  const tips: string[] = [
    `你已录入 ${expCount} 段工作经历。`,
    `最近一段：${latest.company} · ${latest.title}`,
  ];

  if (latest.achievements.length === 0) {
    tips.push(
      `\n💡 **建议补充成就**：「${latest.title}」这段经历还没有量化成果。试着回忆：`,
      `- 你负责的核心指标是什么？提升了多少？`,
      `- 有没有获得表彰、专利、或带领团队完成的项目？`,
      `- 解决了什么关键问题？`
    );
  } else {
    tips.push(`\n已有 ${latest.achievements.length} 条成就记录，继续保持量化表达。`);
  }

  return tips.join("\n");
}

function buildSkillAnalysis(profile: Profile): string {
  const skills = profile.skills;
  const expSkills = profile.workExperiences.flatMap((e) => e.skills);
  const projectTech = profile.projects.flatMap((p) => p.technologies ?? []);
  const allSkills = Array.from(new Set([...skills.map((s) => s.name), ...expSkills, ...projectTech]));

  if (allSkills.length === 0) {
    return `还没有录入技能信息。建议从以下维度梳理：

1. **技术技能**：编程语言、框架、工具（如 Python、React、Docker）
2. **软技能**：沟通、项目管理、跨部门协作
3. **领域知识**：行业经验（如金融、电商、SaaS）

在「我的经历」页面添加技能，或直接告诉我你会什么，我帮你归类。`;
  }

  const expert = skills.filter((s) => s.level === "expert" || s.level === "advanced");
  const totalYears = calcTotalExperienceYears(profile.workExperiences);

  let analysis = `**技能画像分析**\n\n`;
  analysis += `- 共识别 ${allSkills.length} 项技能\n`;
  analysis += `- 累计工作经验约 ${totalYears} 年\n`;

  if (expert.length > 0) {
    analysis += `- 核心优势：${expert.map((s) => s.name).join("、")}\n`;
  }

  analysis += `\n**技能清单**\n`;
  analysis += allSkills.slice(0, 15).map((s) => `• ${s}`).join("\n");

  if (profile.targetRoles.length > 0) {
    analysis += `\n\n**目标岗位**：${profile.targetRoles.join("、")}`;
    analysis += `\n建议在简历中将技能与目标岗位关键词对齐，提高 ATS 通过率。`;
  }

  return analysis;
}

function buildJobRecommend(data: AppData): string {
  const { profile, jobs } = data;
  if (jobs.length === 0) {
    return `还没有添加岗位。你可以：

1. 在「岗位管理」页面手动添加感兴趣的 JD
2. 把招聘链接的描述粘贴给我，我帮你提取关键要求
3. 告诉我你的目标方向，我推荐应该关注的岗位类型

例如：「帮我分析这个岗位：[粘贴 JD 文本]」`;
  }

  const matches = matchAllJobs(profile, jobs);
  const top = matches.slice(0, 5);

  let result = `**岗位匹配推荐**（共 ${jobs.length} 个岗位）\n\n`;

  for (const match of top) {
    const job = jobs.find((j) => j.id === match.jobId)!;
    const emoji = match.score >= 80 ? "🟢" : match.score >= 60 ? "🔵" : match.score >= 40 ? "🟡" : "🔴";
    result += `${emoji} **${job.title}** @ ${job.company} — 匹配度 **${match.score}%**\n`;
    if (match.matchedSkills.length > 0) {
      result += `   ✓ 匹配技能：${match.matchedSkills.slice(0, 4).join("、")}\n`;
    }
    if (match.matchedProjects.length > 0) {
      const projectLines = match.matchedProjects
        .slice(0, 3)
        .map((p) => `${p.name}（${p.reasons.slice(0, 2).join("、")}）`)
        .join("；");
      result += `   ✓ 相关项目：${projectLines}\n`;
    }
    if (match.missingSkills.length > 0) {
      result += `   ✗ 待补充：${match.missingSkills.slice(0, 3).join("、")}\n`;
    }
    result += `   💡 ${match.recommendation}\n\n`;
  }

  return result;
}

function buildResumeSummary(profile: Profile): string {
  if (!profile.name && profile.workExperiences.length === 0) {
    return `请先完善基本信息和工作经历，我才能帮你生成简历摘要。

一个优秀的职业摘要示例：
「5年全栈开发经验，精通 React/Node.js 技术栈，曾主导 3 个百万级用户产品的前端架构设计，擅长性能优化和团队技术选型。」`;
  }

  const totalYears = calcTotalExperienceYears(profile.workExperiences);
  const topSkills = profile.skills
    .filter((s) => s.level === "expert" || s.level === "advanced")
    .map((s) => s.name)
    .slice(0, 5);

  const companies = profile.workExperiences.map((e) => e.company).slice(0, 3);
  const latestTitle = profile.workExperiences[0]?.title || "专业人士";

  let summary = `**自动生成的职业摘要**\n\n`;

  const parts: string[] = [];
  if (totalYears > 0) parts.push(`${Math.round(totalYears)}年${latestTitle}经验`);
  if (topSkills.length > 0) parts.push(`精通 ${topSkills.join("、")}`);
  if (companies.length > 0) parts.push(`曾服务于 ${companies.join("、")}`);

  const achievements = profile.workExperiences.flatMap((e) => e.achievements).slice(0, 2);
  if (achievements.length > 0) {
    parts.push(`代表性成果包括：${achievements.join("；")}`);
  }

  summary += parts.join("，") + "。";

  if (profile.summary) {
    summary += `\n\n**你的自定义摘要**\n${profile.summary}`;
  }

  summary += `\n\n💡 你可以将以上内容复制到简历顶部，或在此基础上修改。`;

  return summary;
}

function buildInterviewPrep(profile: Profile, message: string): string {
  const jobMatch = message.match(/(?:面试|岗位|职位)[：:]?\s*(.+)/);
  const targetRole = jobMatch?.[1] || profile.targetRoles[0] || profile.workExperiences[0]?.title || "目标岗位";

  const skills = profile.skills.map((s) => s.name).slice(0, 5);
  const projects = profile.projects.slice(0, 2);

  let prep = `**「${targetRole}」面试准备指南**\n\n`;
  prep += `**常见面试问题**\n`;
  prep += `1. 请介绍一下你自己\n`;
  prep += `2. 描述一个你最有成就感的项目\n`;
  prep += `3. 你如何处理技术分歧？\n`;
  prep += `4. 你的优势和需要提升的地方？\n`;
  prep += `5. 为什么想加入我们公司？\n\n`;

  prep += `**建议准备的 STAR 案例**\n`;
  for (const exp of profile.workExperiences.slice(0, 2)) {
    prep += `• ${exp.company} - ${exp.title}：`;
    if (exp.achievements.length > 0) {
      prep += exp.achievements[0];
    } else {
      prep += `回忆 1-2 个量化成果（性能提升、成本节约、用户增长等）`;
    }
    prep += `\n`;
  }

  if (skills.length > 0) {
    prep += `\n**技术面试重点**：${skills.join("、")}\n`;
  }
  if (projects.length > 0) {
    prep += `\n**重点准备项目**：${projects.map((p) => p.name).join("、")}\n`;
  }

  prep += `\n💡 告诉我具体公司和岗位，我可以给出更有针对性的面试建议。`;

  return prep;
}

function buildGeneralResponse(profile: Profile): string {
  const completeness = [
    profile.name ? 1 : 0,
    profile.workExperiences.length > 0 ? 1 : 0,
    profile.skills.length > 0 ? 1 : 0,
    profile.summary ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const pct = Math.round((completeness / 4) * 100);

  return `我是你的职业顾问 Agent，可以帮你：

• **梳理工作经历** — 用 STAR 法则整理每段经历
• **分析技能画像** — 识别优势与待提升领域
• **推荐匹配岗位** — 基于你的背景智能匹配 JD
• **生成简历摘要** — 一键输出职业概述
• **面试准备** — 针对性面试问题与案例准备

当前档案完整度：**${pct}%**

你可以说：
- 「帮我梳理工作经历」
- 「分析我的技能」
- 「推荐合适的岗位」
- 「生成简历摘要」
- 「帮我准备面试」`;
}

export function generateAgentResponse(
  message: string,
  data: AppData
): string {
  const intent = detectIntent(message);

  switch (intent) {
    case "greeting":
      return `你好${data.profile.name ? `，${data.profile.name}` : ""}！👋 我是你的职业顾问 Agent。

${buildGeneralResponse(data.profile)}`;
    case "experience_guide":
      return buildExperienceGuide(data.profile);
    case "skill_analysis":
      return buildSkillAnalysis(data.profile);
    case "job_recommend":
      return buildJobRecommend(data);
    case "resume_summary":
      return buildResumeSummary(data.profile);
    case "interview_prep":
      return buildInterviewPrep(data.profile, message);
    default:
      if (/分析.*岗位|jd|职位描述/i.test(message) && message.length > 100) {
        return `收到岗位描述！请在「岗位管理」页面点击「添加岗位」并粘贴这段 JD，系统会自动提取技能要求并计算匹配度。

我也可以帮你解读关键要求 — 请告诉我你最关心的是薪资、技能匹配还是发展空间？`;
      }
      return buildGeneralResponse(data.profile);
  }
}

export function createChatMessage(role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export const QUICK_PROMPTS = [
  "帮我梳理工作经历",
  "分析我的技能优势",
  "推荐合适的岗位",
  "生成简历摘要",
  "帮我准备面试",
];

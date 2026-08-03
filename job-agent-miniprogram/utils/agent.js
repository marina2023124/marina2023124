const storage = require("./storage");

const QUICK_PROMPTS = [
  "帮我梳理工作经历",
  "分析我的技能优势",
  "推荐合适的岗位",
  "生成简历摘要",
  "帮我准备面试",
];

function createChatMessage(role, content) {
  return {
    id: storage.uid("c"),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function detectIntent(message) {
  const m = message.toLowerCase();
  if (/你好|您好|hello|hi|开始/.test(m)) return "greeting";
  if (/经历|工作经验|梳理|整理|star|成就/.test(m)) return "experience_guide";
  if (/技能|能力|优势|短板|分析/.test(m)) return "skill_analysis";
  if (/推荐|匹配|岗位|职位|找工作|投递/.test(m)) return "job_recommend";
  if (/简历|summary|总结|概述/.test(m)) return "resume_summary";
  if (/面试|准备|问题/.test(m)) return "interview_prep";
  return "general";
}

function buildGeneralResponse(profile) {
  const completeness = [
    profile.name ? 1 : 0,
    profile.workExperiences.length > 0 ? 1 : 0,
    profile.skills.length > 0 ? 1 : 0,
    profile.summary ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  const pct = Math.round((completeness / 4) * 100);
  return `我是你的职业顾问，可以帮你梳理经历、分析技能、推荐岗位、生成简历摘要、准备面试。

当前档案完整度：${pct}%

你可以说「帮我梳理工作经历」「分析我的技能」「推荐合适的岗位」等。`;
}

function buildExperienceGuide(profile) {
  if (profile.workExperiences.length === 0) {
    return "你还没有录入工作经历。请到「经历」页添加，或告诉我一段经历，我帮你整理成 STAR 结构。";
  }
  const latest = profile.workExperiences[0];
  return `你已录入 ${profile.workExperiences.length} 段经历。最近一段：${latest.company} · ${latest.title}。

建议补充量化成果，例如性能提升、用户增长、成本节约等具体数字。`;
}

function buildSkillAnalysis(profile) {
  const skills = profile.skills.map((s) => s.name);
  if (skills.length === 0) {
    return "还没有录入技能。请到「经历」页添加技能，或直接告诉我你会什么。";
  }
  return `当前技能：${skills.slice(0, 12).join("、")}${skills.length > 12 ? " 等" : ""}。

建议在 JD 中重点突出与目标岗位最相关的 5-8 项技能。`;
}

function buildJobRecommend(data) {
  const { profile, jobs } = data;
  if (jobs.length === 0) {
    return "还没有岗位。请到「岗位」页智能添加 JD，或在首页查看匹配结果。";
  }
  return `你已关注 ${jobs.length} 个岗位。请到「匹配」页查看规则匹配分数，也可使用 DeepSeek 深度分析。`;
}

function buildResumeSummary(profile) {
  if (!profile.name && profile.workExperiences.length === 0) {
    return "请先完善基本信息和工作经历，再生成简历摘要。";
  }
  const parts = [];
  if (profile.name) parts.push(profile.name);
  if (profile.workExperiences[0]) {
    const e = profile.workExperiences[0];
    parts.push(`${e.title} @ ${e.company}`);
  }
  if (profile.skills.length) {
    parts.push(`核心技能：${profile.skills.slice(0, 6).map((s) => s.name).join("、")}`);
  }
  return `简历摘要草稿：\n${parts.join(" · ")}\n\n可在网页端使用 DeepSeek 生成更完整的职业概述。`;
}

function generateAgentResponse(message, data) {
  const intent = detectIntent(message);
  const { profile } = data;
  switch (intent) {
    case "greeting":
      return `你好${profile.name ? `，${profile.name}` : ""}！\n\n${buildGeneralResponse(profile)}`;
    case "experience_guide":
      return buildExperienceGuide(profile);
    case "skill_analysis":
      return buildSkillAnalysis(profile);
    case "job_recommend":
      return buildJobRecommend(data);
    case "resume_summary":
      return buildResumeSummary(profile);
    case "interview_prep":
      return "告诉我目标公司和岗位，我可以帮你准备面试问题和案例。";
    default:
      return buildGeneralResponse(profile);
  }
}

module.exports = {
  QUICK_PROMPTS,
  createChatMessage,
  generateAgentResponse,
};

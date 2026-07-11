import type { AppData, ChatMessage, Profile } from "./types";
import { generateId } from "./utils";

/** Rough char budget (~8k tokens). */
export const CONTEXT_BUDGET_CHARS = 32_000;
export const COMPRESS_THRESHOLD = 0.6;
const KEEP_RECENT_MESSAGES = 8;

export interface ContextUsage {
  usedChars: number;
  budgetChars: number;
  percent: number;
  shouldCompress: boolean;
  breakdown: {
    profile: number;
    jobs: number;
    chat: number;
  };
}

function createSummaryMessage(role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function compactProfile(profile: Profile): string {
  const lines: string[] = [];
  if (profile.name) lines.push(`姓名:${profile.name}`);
  if (profile.summary) lines.push(`摘要:${profile.summary.slice(0, 200)}`);
  if (profile.targetRoles.length) lines.push(`目标:${profile.targetRoles.join("/")}`);
  for (const exp of profile.workExperiences.slice(0, 6)) {
    lines.push(
      `经历:${exp.company}|${exp.title}|${exp.startDate}-${exp.endDate || "今"}`
    );
    if (exp.achievements[0]) lines.push(`成就:${exp.achievements[0].slice(0, 120)}`);
  }
  for (const skill of profile.skills.slice(0, 20)) {
    lines.push(`技能:${skill.name}`);
  }
  return lines.join("\n");
}

function compactJobs(data: AppData): string {
  return data.jobs
    .slice(0, 12)
    .map((j) => `岗位:${j.company}|${j.title}|${j.experienceYears ?? "-"}年`)
    .join("\n");
}

export function estimateContextChars(data: AppData, extra = ""): ContextUsage {
  const profile = compactProfile(data.profile).length;
  const jobs = compactJobs(data).length;
  const chat = data.chatHistory.reduce((sum, m) => sum + m.content.length + 24, 0);
  const usedChars = profile + jobs + chat + extra.length;
  const percent = Math.min(100, Math.round((usedChars / CONTEXT_BUDGET_CHARS) * 100));

  return {
    usedChars,
    budgetChars: CONTEXT_BUDGET_CHARS,
    percent,
    shouldCompress: usedChars / CONTEXT_BUDGET_CHARS >= COMPRESS_THRESHOLD,
    breakdown: { profile, jobs, chat },
  };
}

function detectTopics(messages: ChatMessage[]): string[] {
  const topics = new Set<string>();
  const text = messages.map((m) => m.content).join("\n");
  if (/经历|工作经验|star|成就/i.test(text)) topics.add("工作经历");
  if (/技能|能力|优势/i.test(text)) topics.add("技能分析");
  if (/岗位|jd|匹配|推荐|投递/i.test(text)) topics.add("岗位匹配");
  if (/简历|摘要|summary/i.test(text)) topics.add("简历摘要");
  if (/面试|准备/i.test(text)) topics.add("面试准备");
  return Array.from(topics);
}

function summarizeOldMessages(messages: ChatMessage[]): ChatMessage {
  const userRounds = messages.filter((m) => m.role === "user").length;
  const topics = detectTopics(messages);
  const topicText = topics.length ? topics.join("、") : "求职咨询";

  const content = `**[上下文已压缩]** 为保持对话持续，已将较早的 ${messages.length} 条消息合并为摘要。

• 累计 ${userRounds} 轮用户提问
• 主要话题：${topicText}
• 最近 ${KEEP_RECENT_MESSAGES} 条消息完整保留

你可以继续提问，我会结合档案与近期对话回答。`;

  return createSummaryMessage("assistant", content);
}

/** Merge older chat turns into one summary and keep recent messages. */
export function compressChatHistory(data: AppData): {
  data: AppData;
  compressed: boolean;
  beforePercent: number;
  afterPercent: number;
} {
  const before = estimateContextChars(data);

  if (data.chatHistory.length <= KEEP_RECENT_MESSAGES + 1) {
    return {
      data,
      compressed: false,
      beforePercent: before.percent,
      afterPercent: before.percent,
    };
  }

  const old = data.chatHistory.slice(0, -KEEP_RECENT_MESSAGES);
  const recent = data.chatHistory.slice(-KEEP_RECENT_MESSAGES);
  const merged = [summarizeOldMessages(old), ...recent];
  const nextData = { ...data, chatHistory: merged };
  const after = estimateContextChars(nextData);

  return {
    data: nextData,
    compressed: true,
    beforePercent: before.percent,
    afterPercent: after.percent,
  };
}

/** Prepare context before agent reply: compress when usage crosses threshold. */
export function prepareContextForReply(
  data: AppData,
  pendingUserMessage: string
): {
  data: AppData;
  usage: ContextUsage;
  compressed: boolean;
  compressionNote?: string;
} {
  const draft: AppData = { ...data, chatHistory: [...data.chatHistory] };
  let usage = estimateContextChars(draft, pendingUserMessage);
  let compressed = false;
  let compressionNote: string | undefined;

  if (usage.shouldCompress) {
    const result = compressChatHistory(draft);
    if (result.compressed) {
      compressed = true;
      compressionNote = `上下文已从 ${result.beforePercent}% 压缩至 ${result.afterPercent}%`;
      usage = estimateContextChars(result.data, pendingUserMessage);
      return { data: result.data, usage, compressed, compressionNote };
    }
  }

  return { data: draft, usage, compressed, compressionNote };
}

export function getContextBarColor(percent: number): string {
  if (percent >= 85) return "bg-red-500";
  if (percent >= 60) return "bg-amber-500";
  return "bg-indigo-500";
}

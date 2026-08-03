import type { ParsedJobDraft } from "../jd-parser";
import { getDeepSeekConfig, isDeepSeekConfigured } from "./config";
import { parseJsonFromLlm } from "./deepseek";

const JD_VISION_PROMPT = `从招聘截图（BOSS直聘、微信卡片、猎聘等）提取岗位信息。
返回 JSON，字段：
title, company, location, salary, description, requirements(数组), responsibilities(数组), preferredSkills(数组)
缺失字段用空字符串或空数组。只返回 JSON，不要 markdown。`;

async function deepseekVisionFetch(base64: string, mimeType: string): Promise<string | null> {
  if (!isDeepSeekConfigured()) return null;

  const { apiKey, baseUrl, model } = getDeepSeekConfig();
  const visionModel = process.env.DEEPSEEK_VISION_MODEL?.trim() || model;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: JD_VISION_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function normalizeVisionDraft(raw: Partial<ParsedJobDraft>): ParsedJobDraft {
  return {
    title: raw.title?.trim() || "未命名岗位",
    company: raw.company?.trim() || "未知公司",
    location: raw.location?.trim() || undefined,
    salary: raw.salary?.trim() || undefined,
    description: raw.description?.trim() || "",
    requirements: Array.isArray(raw.requirements) ? raw.requirements.filter(Boolean) : [],
    responsibilities: Array.isArray(raw.responsibilities) ? raw.responsibilities.filter(Boolean) : [],
    preferredSkills: Array.isArray(raw.preferredSkills) ? raw.preferredSkills.filter(Boolean) : [],
    source: "boss",
  };
}

/** DeepSeek 识图提取 JD（BOSS 禁复制时的首选） */
export async function extractJobFromImageWithVision(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<{ draft: ParsedJobDraft; text: string; source: "vision" } | null> {
  const base64 = Buffer.from(buffer).toString("base64");
  const content = await deepseekVisionFetch(base64, mimeType);
  if (!content) return null;

  try {
    const parsed = parseJsonFromLlm<Partial<ParsedJobDraft>>(content);
    const draft = normalizeVisionDraft(parsed);
    const text = [
      draft.title && `岗位：${draft.title}`,
      draft.company && `公司：${draft.company}`,
      draft.salary && `薪资：${draft.salary}`,
      draft.location && `地点：${draft.location}`,
      draft.description,
      draft.requirements.length && `要求：\n${draft.requirements.join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");
    return { draft, text, source: "vision" };
  } catch {
    return null;
  }
}

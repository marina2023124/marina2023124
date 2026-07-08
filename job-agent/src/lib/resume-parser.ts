import type { Education, Project, Skill, SkillLevel, WorkExperience } from "./types";
import { generateId, parseSkillsFromText } from "./utils";

export interface ParsedProfileDraft {
  name?: string;
  email?: string;
  phone?: string;
  summary?: string;
  targetRoles?: string[];
  targetIndustries?: string[];
  preferredLocations?: string[];
  workExperiences: WorkExperience[];
  educations: Education[];
  projects: Project[];
  skills: Skill[];
}

const SECTION_MARKERS: { key: string; re: RegExp }[] = [
  { key: "summary", re: /^(自我评价|个人简介|个人总结|职业摘要|About Me|Summary)[：:\s]*$/i },
  { key: "work", re: /^(工作经历|工作经验|职业经历|任职经历|Work Experience)[：:\s]*$/i },
  { key: "project", re: /^(项目经验|项目经历|项目介绍|Projects?)[：:\s]*$/i },
  { key: "education", re: /^(教育背景|教育经历|Education)[：:\s]*$/i },
  { key: "skill", re: /^(专业技能|核心技能|技能特长|掌握技能|Skills?)[：:\s]*$/i },
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:\+?86[-\s]?)?\d{3,4}[-\s]?\d{7,8}/;
const DATE_RANGE_RE =
  /(\d{4})[./年-]?(\d{1,2})?[./月-]?\s*(?:[-–—~至到\s]+)\s*(至今|现在|present|\d{4}[./年-]?\d{0,2}[./月]?)?/i;

const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "React", "Vue", "Node.js", "SQL",
  "Excel", "PPT", "PowerPoint", "数据分析", "机器学习", "深度学习", "TensorFlow",
  "PyTorch", "Spark", "Hadoop", "Tableau", "Power BI", "Figma", "AWS", "Docker",
  "Kubernetes", "Go", "Rust", "C++", "MySQL", "PostgreSQL", "MongoDB", "Redis",
  "Next.js", "Angular", "Spring", "Git", "Linux", "HTML", "CSS", "Sass",
];

function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (/至今|现在|present/i.test(t)) return undefined;
  const m = t.match(/(\d{4})[./年-]?(\d{1,2})?/);
  if (!m) return undefined;
  const month = m[2] ? m[2].padStart(2, "0") : "01";
  return `${m[1]}-${month}`;
}

function parseListLines(block: string): string[] {
  return block
    .split("\n")
    .map((l) =>
      l
        .trim()
        .replace(/^[-*•●]\s*/, "")
        .replace(/^\d+[、.．)\]]\s*/, "")
    )
    .filter((l) => l.length >= 4);
}

function splitSections(text: string): Record<string, string> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Record<string, string> = { header: "" };
  let current = "header";

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    const marker = SECTION_MARKERS.find((m) => m.re.test(t));
    if (marker) {
      current = marker.key;
      if (!sections[current]) sections[current] = "";
      continue;
    }

    sections[current] = (sections[current] ? sections[current] + "\n" : "") + t;
  }

  return sections;
}

function parseWorkBlock(block: string): WorkExperience[] {
  const results: WorkExperience[] = [];
  const chunks = block.split(/\n(?=\d{4}[./年-])|\n(?=[^\n]{2,30}(?:公司|科技|集团|有限|Inc|Ltd))/);

  for (const chunk of chunks.length > 1 ? chunks : [block]) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const first = lines[0];
    const dateMatch = first.match(DATE_RANGE_RE);
    let rest = first;
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (dateMatch) {
      startDate = normalizeDate(dateMatch[1] + (dateMatch[2] ? `.${dateMatch[2]}` : ""));
      endDate = normalizeDate(dateMatch[3]);
      rest = first.replace(DATE_RANGE_RE, "").trim();
    }

    const parts = rest.split(/[|｜·•—–-]/).map((p) => p.trim()).filter(Boolean);
    let company = "";
    let title = "";

    if (parts.length >= 2) {
      if (/\d{4}/.test(parts[0])) {
        title = parts[parts.length - 1];
        company = parts.slice(0, -1).join(" ");
      } else {
        company = parts[0];
        title = parts[1];
      }
    } else {
      const tokens = rest.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        company = tokens.slice(0, -1).join(" ");
        title = tokens[tokens.length - 1];
      } else if (tokens.length === 1) {
        title = tokens[0];
      }
    }

    const bullets = lines.slice(1).filter((l) => /^[-*•●\d]/.test(l) || l.length > 10);
    const achievements = parseListLines(bullets.join("\n"));
    const description = lines.slice(1).filter((l) => !achievements.includes(l.replace(/^[-*•●\d、.．)\]]\s*/, ""))).join("\n");

    if (!company && !title) continue;

    results.push({
      id: generateId(),
      company: company || "未知公司",
      title: title || "未知职位",
      startDate: startDate || "",
      endDate,
      description: description.trim(),
      achievements,
      skills: extractSkillsFromText(chunk),
    });
  }

  return results;
}

function parseEducationBlock(block: string): Education[] {
  const results: Education[] = [];
  for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const dateMatch = line.match(DATE_RANGE_RE);
    let rest = line;
    let startDate = "";
    let endDate: string | undefined;

    if (dateMatch) {
      startDate = normalizeDate(dateMatch[1] + (dateMatch[2] ? `.${dateMatch[2]}` : "")) || "";
      endDate = normalizeDate(dateMatch[3]);
      rest = line.replace(DATE_RANGE_RE, "").trim();
    }

    const parts = rest.split(/[|｜·•—–-]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      const tokens = rest.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        results.push({
          id: generateId(),
          school: tokens[0],
          degree: tokens[1],
          field: tokens[2] || "",
          startDate,
          endDate,
        });
      }
      continue;
    }

    results.push({
      id: generateId(),
      school: parts[0],
      degree: parts[1],
      field: parts[2] || "",
      startDate,
      endDate,
    });
  }
  return results;
}

function parseProjectBlock(block: string): Project[] {
  const results: Project[] = [];
  const chunks = block.split(/\n(?=[^\n：:]{2,30}(?:项目|系统|平台|Project))/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const nameLine = lines[0].replace(/^[-*•●\d、.．)\]]\s*/, "");
    const name = nameLine.split(/[：:]/)[0]?.trim();
    if (!name || name.length < 2) continue;

    const descLines = lines.slice(1);
    const highlights = parseListLines(descLines.join("\n"));
    const description = descLines.find((l) => !/^[-*•●\d]/.test(l)) || highlights[0] || "";

    results.push({
      id: generateId(),
      name,
      description,
      technologies: extractSkillsFromText(chunk),
      highlights: highlights.length ? highlights : description ? [description] : [],
    });
  }

  return results;
}

function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    if (new RegExp(skill.replace(/[.+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      found.add(skill);
    }
  }
  parseSkillsFromText(text).forEach((s) => {
    if (s.length <= 20 && !/\d{4}/.test(s)) found.add(s);
  });
  return Array.from(found).slice(0, 30);
}

function parseSkillsBlock(block: string): Skill[] {
  const names = extractSkillsFromText(block);
  return names.map((name) => ({
    id: generateId(),
    name,
    level: "intermediate" as SkillLevel,
  }));
}

function parseHeaderInfo(header: string, draft: ParsedProfileDraft): void {
  const email = header.match(EMAIL_RE)?.[0];
  const phone = header.match(PHONE_RE)?.[0];
  if (email) draft.email = email;
  if (phone) draft.phone = phone.replace(/\s+/g, "");

  const lines = header.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (/^(姓名|名字)[：:]\s*(.+)/.test(line)) {
      draft.name = line.replace(/^(姓名|名字)[：:]\s*/, "").trim();
      continue;
    }
    if (!draft.name && line.length >= 2 && line.length <= 8 && /^[\u4e00-\u9fa5]{2,4}$/.test(line)) {
      draft.name = line;
    }
  }
}

/** 从 Excel 行解析项目列表 */
export function parseProjectsFromExcelRows(rows: Record<string, string>[]): Project[] {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const findCol = (...candidates: string[]) =>
    headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c.toLowerCase())));

  const nameCol = findCol("项目", "name", "名称", "title");
  const descCol = findCol("描述", "description", "简介", "说明", "内容");
  const techCol = findCol("技术", "tech", "栈", "工具");
  const highlightCol = findCol("亮点", "成果", "highlight", "achievement", "职责");

  return rows
    .map((row) => {
      const name = (nameCol ? row[nameCol] : Object.values(row)[0])?.trim();
      if (!name) return null;

      const description = descCol ? row[descCol]?.trim() || "" : "";
      const techText = techCol ? row[techCol] : "";
      const highlightText = highlightCol ? row[highlightCol] : "";

      return {
        id: generateId(),
        name,
        description,
        technologies: parseSkillsFromText(techText),
        highlights: highlightText ? parseListLines(highlightText) : [],
      } satisfies Project;
    })
    .filter((p): p is Project => p !== null);
}

export function parseResumeText(text: string): ParsedProfileDraft {
  const draft: ParsedProfileDraft = {
    workExperiences: [],
    educations: [],
    projects: [],
    skills: [],
  };

  if (!text.trim()) return draft;

  const sections = splitSections(text);
  parseHeaderInfo(sections.header || text.split("\n").slice(0, 8).join("\n"), draft);

  if (sections.summary) draft.summary = sections.summary.trim();
  if (sections.work) draft.workExperiences = parseWorkBlock(sections.work);
  if (sections.education) draft.educations = parseEducationBlock(sections.education);
  if (sections.project) draft.projects = parseProjectBlock(sections.project);
  if (sections.skill) draft.skills = parseSkillsBlock(sections.skill);

  if (!draft.skills.length) {
    draft.skills = parseSkillsBlock(text).slice(0, 20);
  }

  if (!draft.workExperiences.length) {
    const fallback = text.match(
      /(?:工作经历|工作经验)[：:]?\s*\n([\s\S]*?)(?=项目经验|教育背景|专业技能|$)/i
    );
    if (fallback?.[1]) draft.workExperiences = parseWorkBlock(fallback[1]);
  }

  return draft;
}

export function summarizeParsedProfile(draft: ParsedProfileDraft): string {
  const parts: string[] = [];
  if (draft.name) parts.push(`姓名：${draft.name}`);
  if (draft.workExperiences.length) parts.push(`工作经历 ${draft.workExperiences.length} 段`);
  if (draft.projects.length) parts.push(`项目 ${draft.projects.length} 个`);
  if (draft.educations.length) parts.push(`教育 ${draft.educations.length} 条`);
  if (draft.skills.length) parts.push(`技能 ${draft.skills.length} 项`);
  return parts.join(" · ") || "未识别到结构化内容";
}

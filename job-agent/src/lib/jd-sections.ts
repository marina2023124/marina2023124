/** JD 三大版块：职位描述（工时/福利）、岗位职责、任职要求 */

export type SectionKind = "intro" | "responsibilities" | "requirements";

export interface ParsedSections {
  jobIntro: string;
  responsibilities: string[];
  requirements: string[];
}

const STOP_LINE =
  /^(工作地址|公司介绍|公司基本信息|工商信息|查看全部|点击查看|陈女士|竞争力|BOSS|来源：|首页|举报|微信扫码)/;

/** 非三大版块的分界标题（截断当前版块内容） */
const BOUNDARY_LINE = STOP_LINE;

/** 同义词 → 标准版块（intro / responsibilities / requirements） */
const HEADER_SYNONYMS: { kind: SectionKind; labels: string[] }[] = [
  {
    kind: "intro",
    labels: [
      "职位描述", // BOSS：工时/福利区（若另有「岗位职责」则归 intro）
      "工作信息",
      "工作时间",
      "上班考勤",
      "考勤时间",
      "福利待遇",
      "岗位说明",
      "工作制度",
    ],
  },
  {
    kind: "responsibilities",
    labels: [
      "岗位职责",
      "工作职责",
      "工作内容",
      "主要职责",
      "职责描述",
      "你将负责",
      "岗位内容",
      "Job Description",
      "Responsibilities",
    ],
  },
  {
    kind: "requirements",
    labels: [
      "任职要求",
      "任职条件",
      "岗位要求",
      "任职资格",
      "招聘要求",
      "我们要求",
      "候选人要求",
      "你需要具备",
      "必备条件",
      "Requirements",
      "Qualifications",
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeaderRegex(label: string): RegExp {
  const e = escapeRegExp(label);
  return new RegExp(
    `^(?:【\\s*)?${e}(?:\\s*】)?[：:\\s]*(?:\\s*(.+))?$`,
    "i"
  );
}

interface HeaderMatch {
  kind: SectionKind;
  label: string;
  lineIndex: number;
  inlineContent?: string;
}

function matchHeaderLine(line: string): Omit<HeaderMatch, "lineIndex"> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return null;

  for (const { kind, labels } of HEADER_SYNONYMS) {
    for (const label of labels) {
      const re = buildHeaderRegex(label);
      const m = trimmed.match(re);
      if (m) {
        const inline = m[1]?.trim();
        return { kind, label, inlineContent: inline || undefined };
      }
    }
  }
  return null;
}

function sliceUntilBoundary(lines: string[], start: number, end: number): string {
  const out: string[] = [];
  for (let i = start; i < end; i++) {
    const t = lines[i].trim();
    if (BOUNDARY_LINE.test(t)) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

function parseListItems(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || STOP_LINE.test(trimmed)) continue;
    const cleaned = trimmed
      .replace(/^[-*•●]\s*/, "")
      .replace(/^\d+[、.．)\]]\s*/, "")
      .replace(/^[（(]\d+[）)]\s*/, "")
      .trim();
    if (cleaned.length >= 4) items.push(cleaned);
  }
  return items;
}

function contentLooksLikeIntro(text: string): boolean {
  return /上班|考勤|双休|福利|待遇|弹性|午休|假期|五险|公积金|加班|工作时间|打卡/.test(text);
}

function contentLooksLikeDuties(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasNumbered = lines.some((l) => /^\d+[、.．)]/.test(l));
  const hasDutyWords = /负责|完成|参与|协助|推动|搭建|开发|设计|撰写|管理|承担|主导/.test(text);
  return hasNumbered && hasDutyWords;
}

function splitIntroAndDuties(block: string): { intro: string; duties: string[] } {
  const lines = block.split("\n");
  const introLines: string[] = [];
  const dutyLines: string[] = [];
  let inDuty = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^岗位职责[：:]\s*/.test(t)) {
      inDuty = true;
      const rest = t.replace(/^岗位职责[：:]\s*/, "").trim();
      if (rest) dutyLines.push(rest);
      continue;
    }
    if (!inDuty && /^\d+[、.．)]/.test(t) && /负责|完成|参与|协助|搭建|推动/.test(t)) {
      inDuty = true;
    }
    if (inDuty) dutyLines.push(t);
    else introLines.push(t);
  }

  return {
    intro: introLines.join("\n").trim(),
    duties: parseListItems(dutyLines.join("\n")),
  };
}

/** 从全文识别三大版块（支持同义标题） */
export function extractJobSections(text: string): ParsedSections {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headers: HeaderMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = matchHeaderLine(lines[i]);
    if (m) headers.push({ ...m, lineIndex: i });
  }

  const result: ParsedSections = {
    jobIntro: "",
    responsibilities: [],
    requirements: [],
  };

  if (headers.length === 0) {
    return inferSectionsFromPlainText(text);
  }

  const hasRespHeader = headers.some((h) => h.kind === "responsibilities");
  const hasIntroHeader = headers.some((h) => h.kind === "intro");

  for (let h = 0; h < headers.length; h++) {
    const header = headers[h];
    let kind = header.kind;

    // 「职位描述」在 BOSS 上通常是工时/福利；若无「岗位职责」且内容像职责，则归 responsibilities
    if (header.label === "职位描述" || header.label === "岗位说明") {
      if (hasRespHeader) {
        kind = "intro";
      } else {
        const nextIdx = headers[h + 1]?.lineIndex ?? lines.length;
        const block = lines.slice(header.lineIndex + 1, nextIdx).join("\n");
        if (contentLooksLikeDuties(block) && !contentLooksLikeIntro(block)) {
          kind = "responsibilities";
        } else if (hasIntroHeader && h > 0) {
          kind = "responsibilities";
        } else {
          kind = "intro";
        }
      }
    }

    const startLine = header.lineIndex + 1;
    const endLine = headers[h + 1]?.lineIndex ?? lines.length;
    let block = sliceUntilBoundary(lines, startLine, endLine);

    if (header.inlineContent) {
      block = header.inlineContent + (block ? `\n${block}` : "");
    }

    if (!block) continue;

    if (STOP_LINE.test(block.split("\n")[0]?.trim() || "")) continue;

    if (kind === "intro") {
      if (contentLooksLikeIntro(block) && contentLooksLikeDuties(block)) {
        const split = splitIntroAndDuties(block);
        result.jobIntro = [result.jobIntro, split.intro].filter(Boolean).join("\n\n");
        result.responsibilities.push(...split.duties);
      } else {
        result.jobIntro = [result.jobIntro, block].filter(Boolean).join("\n\n");
      }
    } else if (kind === "responsibilities") {
      result.responsibilities.push(...parseListItems(block));
    } else {
      result.requirements.push(...parseListItems(block));
    }
  }

  return dedupeSections(result);
}

function inferSectionsFromPlainText(text: string): ParsedSections {
  const result: ParsedSections = { jobIntro: "", responsibilities: [], requirements: [] };

  const dutyMatch = text.match(
    /(?:岗位职责|工作内容|工作职责)[：:]?\s*\n([\s\S]*?)(?=任职条件|任职要求|岗位要求|工作地址|$)/i
  );
  if (dutyMatch?.[1]) {
    result.responsibilities = parseListItems(dutyMatch[1]);
  }

  const reqMatch = text.match(
    /(?:任职要求|任职条件|岗位要求|任职资格|招聘要求)[：:]?\s*\n([\s\S]*?)(?=工作地址|公司介绍|公司基本信息|工商信息|$)/i
  );
  if (reqMatch?.[1]) {
    result.requirements = parseListItems(reqMatch[1]);
  }

  const introMatch = text.match(
    /(?:职位描述|工作信息|福利待遇)[：:]?\s*\n([\s\S]*?)(?=岗位职责|工作内容|任职要求|任职条件|$)/i
  );
  if (introMatch?.[1]) {
    const block = introMatch[1].trim();
    if (contentLooksLikeIntro(block)) {
      result.jobIntro = block;
    } else if (!result.responsibilities.length && contentLooksLikeDuties(block)) {
      result.responsibilities = parseListItems(block);
    } else {
      result.jobIntro = block;
    }
  }

  return dedupeSections(result);
}

function dedupeSections(s: ParsedSections): ParsedSections {
  const seen = new Set<string>();
  const dedupe = (arr: string[]) =>
    arr.filter((item) => {
      const key = item.slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    jobIntro: s.jobIntro.trim(),
    responsibilities: dedupe(s.responsibilities).slice(0, 20),
    requirements: dedupe(s.requirements).slice(0, 15),
  };
}

export function sectionsToDescription(sections: ParsedSections): string {
  const parts: string[] = [];
  if (sections.jobIntro) parts.push(`【职位描述】\n${sections.jobIntro}`);
  if (sections.responsibilities.length) {
    parts.push(
      `【岗位职责】\n${sections.responsibilities.map((r, i) => `${i + 1}、${r}`).join("\n")}`
    );
  }
  if (sections.requirements.length) {
    parts.push(
      `【任职要求】\n${sections.requirements.map((r, i) => `${i + 1}、${r}`).join("\n")}`
    );
  }
  return parts.join("\n\n");
}

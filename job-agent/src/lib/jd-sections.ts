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

/** BOSS 常见：「职位描述」大标题下嵌套「岗位职责」「任职条件」 */
const NESTED_RESP_RE = /(?:岗位职责|工作内容|工作职责)[：:\s]*/i;
const NESTED_REQ_RE = /(?:任职要求|任职条件|岗位要求|任职资格)[：:\s]*/i;

/** 同义词 → 标准版块（intro / responsibilities / requirements） */
const HEADER_SYNONYMS: { kind: SectionKind; labels: string[] }[] = [
  {
    kind: "intro",
    labels: [
      "职位描述",
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

function buildInlineHeaderRegex(label: string): RegExp {
  const e = escapeRegExp(label);
  return new RegExp(`^(?:【\\s*)?${e}(?:\\s*】)?[：:]\\s*(.+)$`, "i");
}

interface HeaderMatch {
  kind: SectionKind;
  label: string;
  lineIndex: number;
  inlineContent?: string;
}

function matchHeaderLine(line: string): Omit<HeaderMatch, "lineIndex"> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  for (const { kind, labels } of HEADER_SYNONYMS) {
    for (const label of labels) {
      const inlineRe = buildInlineHeaderRegex(label);
      const inlineMatch = trimmed.match(inlineRe);
      if (inlineMatch?.[1]?.trim()) {
        return { kind, label, inlineContent: inlineMatch[1].trim() };
      }

      if (trimmed.length <= 48) {
        const re = buildHeaderRegex(label);
        const m = trimmed.match(re);
        if (m) {
          const inline = m[1]?.trim();
          return { kind, label, inlineContent: inline || undefined };
        }
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
    if (NESTED_RESP_RE.test(trimmed) && trimmed.length < 20) continue;
    if (NESTED_REQ_RE.test(trimmed) && trimmed.length < 20) continue;
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
  return /上班|考勤|双休|福利|待遇|弹性|午休|假期|五险|公积金|加班|工作时间|打卡|13:30|18:30/.test(
    text
  );
}

function contentLooksLikeDuties(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasNumbered = lines.some((l) => /^\d+[、.．)]/.test(l));
  const hasDutyWords = /负责|完成|参与|协助|推动|搭建|开发|设计|撰写|管理|承担|主导|运用|沟通/.test(
    text
  );
  return hasNumbered && hasDutyWords;
}

/** BOSS 嵌套：职位描述块内含 岗位职责 / 任职条件 子标题 */
function splitNestedSubsections(block: string): ParsedSections {
  const result: ParsedSections = { jobIntro: "", responsibilities: [], requirements: [] };
  let mode: "intro" | "resp" | "req" = "intro";
  const introLines: string[] = [];
  const respLines: string[] = [];
  const reqLines: string[] = [];

  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t || STOP_LINE.test(t)) continue;

    const respInline = t.match(/^(?:岗位职责|工作内容|工作职责)[：:]\s*(.*)$/i);
    if (respInline) {
      mode = "resp";
      if (respInline[1]?.trim()) respLines.push(respInline[1].trim());
      continue;
    }
    if (/^(?:岗位职责|工作内容|工作职责)[：:]?\s*$/i.test(t)) {
      mode = "resp";
      continue;
    }

    const reqInline = t.match(/^(?:任职要求|任职条件|岗位要求|任职资格)[：:]\s*(.*)$/i);
    if (reqInline) {
      mode = "req";
      if (reqInline[1]?.trim()) reqLines.push(reqInline[1].trim());
      continue;
    }
    if (/^(?:任职要求|任职条件|岗位要求|任职资格)[：:]?\s*$/i.test(t)) {
      mode = "req";
      continue;
    }

    if (mode === "intro") introLines.push(t);
    else if (mode === "resp") respLines.push(t);
    else reqLines.push(t);
  }

  result.jobIntro = introLines.join("\n").trim();
  result.responsibilities = parseListItems(respLines.join("\n"));
  result.requirements = parseListItems(reqLines.join("\n"));
  return result;
}

function hasNestedSubsections(block: string): boolean {
  return NESTED_RESP_RE.test(block) || NESTED_REQ_RE.test(block);
}

function mergeSections(a: ParsedSections, b: ParsedSections): ParsedSections {
  return dedupeSections({
    jobIntro: [a.jobIntro, b.jobIntro].filter(Boolean).join("\n\n"),
    responsibilities: [...a.responsibilities, ...b.responsibilities],
    requirements: [...a.requirements, ...b.requirements],
  });
}

/** 从全文识别三大版块（支持同义标题） */
export function extractJobSections(text: string): ParsedSections {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
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
    return inferSectionsFromPlainText(normalized);
  }

  const hasRespHeader = headers.some((h) => h.kind === "responsibilities");
  const hasReqHeader = headers.some((h) => h.kind === "requirements");

  for (let h = 0; h < headers.length; h++) {
    const header = headers[h];
    let kind = header.kind;

    if (header.label === "职位描述" || header.label === "岗位说明") {
      if (hasRespHeader || hasReqHeader) {
        kind = "intro";
      } else {
        const nextIdx = headers[h + 1]?.lineIndex ?? lines.length;
        const previewBlock = lines.slice(header.lineIndex + 1, nextIdx).join("\n");
        if (hasNestedSubsections(previewBlock)) {
          kind = "intro";
        } else if (contentLooksLikeDuties(previewBlock) && !contentLooksLikeIntro(previewBlock)) {
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

    if (kind === "intro" && hasNestedSubsections(block)) {
      const nested = splitNestedSubsections(block);
      Object.assign(result, mergeSections(result, nested));
      continue;
    }

    if (kind === "intro") {
      if (contentLooksLikeIntro(block) && contentLooksLikeDuties(block)) {
        const nested = splitNestedSubsections(block);
        Object.assign(result, mergeSections(result, nested));
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

  const introRegion = text.match(
    /(?:职位描述|工作信息|福利待遇)[：:]?\s*\n([\s\S]*?)(?=岗位职责|工作内容|工作职责|任职要求|任职条件|岗位要求|工作地址|$)/i
  );
  if (introRegion?.[1]) {
    const block = introRegion[1].trim();
    if (hasNestedSubsections(block)) {
      Object.assign(result, mergeSections(result, splitNestedSubsections(block)));
    } else if (contentLooksLikeIntro(block)) {
      result.jobIntro = block;
    } else if (contentLooksLikeDuties(block)) {
      result.responsibilities = parseListItems(block);
    } else {
      result.jobIntro = block;
    }
  }

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

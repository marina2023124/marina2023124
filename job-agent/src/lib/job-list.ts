import type { JobPosting, JobStatus } from "./types";

export type JobSortField =
  | "createdAt"
  | "salary"
  | "industry"
  | "title"
  | "experienceYears"
  | "interestRating";

export type SortOrder = "asc" | "desc";

export interface JobListFilters {
  query?: string;
  industry?: string;
  status?: JobStatus | "";
  minInterest?: number;
  minExperience?: number;
  maxExperience?: number;
}

export interface JobListPrefs {
  sortField: JobSortField;
  sortOrder: SortOrder;
  filters: JobListFilters;
}

export const DEFAULT_JOB_LIST_PREFS: JobListPrefs = {
  sortField: "createdAt",
  sortOrder: "desc",
  filters: {},
};

const INDUSTRY_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "互联网", patterns: [/互联网/, /在线服务/, /字节跳动/, /腾讯/, /阿里巴巴/, /阿里/, /美团/, /快手/, /小红书/, /百度/, /网易/, /滴滴/, /拼多多/] },
  { label: "教育", patterns: [/教育/, /培训/, /猿辅导/, /学而思/, /作业帮/, /好未来/, /新东方/] },
  { label: "电商", patterns: [/电商/, /电子商务/, /零售/, /类目运营/, /淘宝/, /京东/] },
  { label: "金融", patterns: [/金融/, /银行/, /保险/, /证券/, /支付/, /FinTech/, /fintech/i] },
  { label: "游戏", patterns: [/游戏/, /手游/, /电竞/] },
  { label: "广告营销", patterns: [/广告/, /营销/, /传媒/, /MCN/, /品牌传播/] },
  { label: "咨询", patterns: [/咨询/, /顾问/, /McKinsey/i, /BCG/i, /埃森哲/] },
  { label: "硬件制造", patterns: [/硬件/, /制造/, /电子/, /半导体/, /芯片/] },
  { label: "人工智能", patterns: [/人工智能/, /AI\b/, /大模型/, /机器学习/, /深度学习/] },
  { label: "医疗健康", patterns: [/医疗/, /健康/, /医药/, /生物/] },
  { label: "汽车", patterns: [/汽车/, /新能源/, /自动驾驶/, /车联网/] },
  { label: "本地生活", patterns: [/本地生活/, /外卖/, /到店/, /生活服务/] },
];

const KNOWN_INDUSTRIES = INDUSTRY_PATTERNS.map((item) => item.label);

/** 解析薪资字符串为可排序数值（月薪 K，含薪月数折算） */
export function parseSalarySortValue(salary?: string): number {
  if (!salary?.trim() || /面议|negotiable/i.test(salary)) return -1;

  const rangeK = salary.match(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)\s*[Kk]/);
  if (rangeK) {
    const monthlyK = (Number(rangeK[1]) + Number(rangeK[2])) / 2;
    const months = salary.match(/(\d+)\s*薪/);
    return months ? monthlyK * (Number(months[1]) / 12) : monthlyK;
  }

  const singleK = salary.match(/(\d+(?:\.\d+)?)\s*[Kk]/);
  if (singleK) {
    const monthlyK = Number(singleK[1]);
    const months = salary.match(/(\d+)\s*薪/);
    return months ? monthlyK * (Number(months[1]) / 12) : monthlyK;
  }

  const wanRange = salary.match(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)\s*万/);
  if (wanRange) {
    return ((Number(wanRange[1]) + Number(wanRange[2])) / 2) * 10;
  }

  return -1;
}

/** 从 JD / 公司信息推断行业 */
export function inferJobIndustry(job: Pick<JobPosting, "company" | "title" | "description" | "jobIntro" | "requirements" | "responsibilities">): string | undefined {
  const blob = [
    job.company,
    job.title,
    job.jobIntro,
    job.description,
    ...(job.requirements ?? []),
    ...(job.responsibilities ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  for (const { label, patterns } of INDUSTRY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(blob))) return label;
  }

  const explicit = blob.match(/(?:所属行业|行业)[：:\s]*([^\n·]{2,12})/);
  if (explicit?.[1]) {
    const value = explicit[1].trim();
    if (value.length >= 2 && value.length <= 12) return value;
  }

  const bossMeta = blob.match(/(?:^|\n)(互联网|教育|金融|游戏|电商|广告营销|咨询|医疗健康|汽车)(?:\s*[·|])/m);
  if (bossMeta?.[1]) return bossMeta[1];

  return undefined;
}

/** 展示/筛选用行业名 */
export function getJobIndustry(job: JobPosting): string {
  return job.industry?.trim() || inferJobIndustry(job) || "未分类";
}

export function getJobIndustryOptions(jobs: JobPosting[]): string[] {
  const values = new Set<string>(KNOWN_INDUSTRIES);
  for (const job of jobs) {
    const industry = getJobIndustry(job);
    if (industry && industry !== "未分类") values.add(industry);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "zh"));
}

function compareNullableNumber(a: number | undefined, b: number | undefined, order: SortOrder): number {
  const av = a ?? -1;
  const bv = b ?? -1;
  if (av === bv) return 0;
  return order === "asc" ? av - bv : bv - av;
}

function compareText(a: string, b: string, order: SortOrder): number {
  const result = a.localeCompare(b, "zh");
  return order === "asc" ? result : -result;
}

export function sortJobs(jobs: JobPosting[], field: JobSortField, order: SortOrder): JobPosting[] {
  const sorted = [...jobs];
  sorted.sort((a, b) => {
    switch (field) {
      case "createdAt":
        return compareText(a.createdAt || "", b.createdAt || "", order);
      case "salary":
        return compareNullableNumber(parseSalarySortValue(a.salary), parseSalarySortValue(b.salary), order);
      case "industry":
        return compareText(getJobIndustry(a), getJobIndustry(b), order);
      case "title":
        return compareText(a.title || "", b.title || "", order);
      case "experienceYears":
        return compareNullableNumber(a.experienceYears, b.experienceYears, order);
      case "interestRating":
        return compareNullableNumber(a.interestRating, b.interestRating, order);
      default:
        return 0;
    }
  });
  return sorted;
}

export function filterJobs(jobs: JobPosting[], filters: JobListFilters): JobPosting[] {
  const query = filters.query?.trim().toLowerCase();
  return jobs.filter((job) => {
    if (query) {
      const haystack = [
        job.title,
        job.company,
        job.location,
        job.salary,
        getJobIndustry(job),
        job.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.industry && getJobIndustry(job) !== filters.industry) return false;

    if (filters.status && job.status !== filters.status) return false;

    if (filters.minInterest && filters.minInterest > 0) {
      const rating = job.interestRating ?? 0;
      if (rating < filters.minInterest) return false;
    }

    if (filters.minExperience != null && filters.minExperience > 0) {
      const years = job.experienceYears ?? 0;
      if (years < filters.minExperience) return false;
    }

    if (filters.maxExperience != null && filters.maxExperience >= 0) {
      const years = job.experienceYears ?? 0;
      if (years > filters.maxExperience) return false;
    }

    return true;
  });
}

export function applyJobListPrefs(jobs: JobPosting[], prefs: JobListPrefs): JobPosting[] {
  return sortJobs(filterJobs(jobs, prefs.filters), prefs.sortField, prefs.sortOrder);
}

const PREFS_KEY = "job-agent-job-list-prefs";

export function loadJobListPrefs(): JobListPrefs {
  if (typeof window === "undefined") return DEFAULT_JOB_LIST_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_JOB_LIST_PREFS;
    const parsed = JSON.parse(raw) as Partial<JobListPrefs>;
    return {
      sortField: parsed.sortField ?? DEFAULT_JOB_LIST_PREFS.sortField,
      sortOrder: parsed.sortOrder ?? DEFAULT_JOB_LIST_PREFS.sortOrder,
      filters: { ...DEFAULT_JOB_LIST_PREFS.filters, ...(parsed.filters ?? {}) },
    };
  } catch {
    return DEFAULT_JOB_LIST_PREFS;
  }
}

export function saveJobListPrefs(prefs: JobListPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

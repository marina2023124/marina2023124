export interface BossPageIds {
  securityId?: string;
  lid?: string;
  encryptJobId?: string;
}

export function parseBossJobPath(pathname: string): string | undefined {
  const match = pathname.match(/\/job_detail\/([^.?#/]+)\.html/i);
  return match?.[1];
}

export function extractBossIdsFromSearch(search: string): BossPageIds {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return {
    securityId:
      params.get("securityId") ||
      params.get("securityid") ||
      params.get("secId") ||
      undefined,
    lid: params.get("lid") || undefined,
    encryptJobId:
      params.get("encryptJobId") ||
      params.get("jobId") ||
      params.get("jobid") ||
      undefined,
  };
}

export function extractBossIdsFromPerformance(entries: { name: string }[]): BossPageIds {
  const result: BossPageIds = {};
  for (let i = entries.length - 1; i >= 0; i--) {
    const url = entries[i].name;
    if (!/\/job\/detail\.json/i.test(url)) continue;
    const securityMatch = url.match(/[?&]securityId=([^&]+)/i);
    if (securityMatch) result.securityId = decodeURIComponent(securityMatch[1]);
    const lidMatch = url.match(/[?&]lid=([^&]+)/i);
    if (lidMatch) result.lid = decodeURIComponent(lidMatch[1]);
    const jobMatch = url.match(/[?&]encryptJobId=([^&]+)/i);
    if (jobMatch) result.encryptJobId = decodeURIComponent(jobMatch[1]);
    if (result.securityId) break;
  }
  return result;
}

export function findBossDetailApiUrl(entries: { name: string }[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const url = entries[i].name;
    if (/\/job\/detail\.json/i.test(url) && /securityId=/i.test(url)) {
      return url;
    }
  }
  return undefined;
}

export function extractBossIdsFromHtml(html: string): BossPageIds {
  const result: BossPageIds = {};
  const securityMatch = html.match(/"securityId"\s*:\s*"([^"]{8,})"/);
  if (securityMatch) result.securityId = securityMatch[1];
  const lidMatch = html.match(/"lid"\s*:\s*"([^"]+)"/);
  if (lidMatch) result.lid = lidMatch[1];
  const jobMatch = html.match(/"encryptJobId"\s*:\s*"([^"]+)"/);
  if (jobMatch) result.encryptJobId = jobMatch[1];
  return result;
}

export function mergeBossPageIds(...parts: Array<BossPageIds | undefined>): BossPageIds {
  const result: BossPageIds = {};
  for (const part of parts) {
    if (!part) continue;
    if (!result.securityId && part.securityId) result.securityId = part.securityId;
    if (!result.lid && part.lid) result.lid = part.lid;
    if (!result.encryptJobId && part.encryptJobId) result.encryptJobId = part.encryptJobId;
  }
  return result;
}

export function buildBossDetailApiUrl(ids: BossPageIds): string | null {
  if (!ids.securityId) return null;
  const params = new URLSearchParams();
  params.set("securityId", ids.securityId);
  if (ids.lid) params.set("lid", ids.lid);
  if (ids.encryptJobId) params.set("encryptJobId", ids.encryptJobId);
  return `/wapi/zpgeek/job/detail.json?${params.toString()}`;
}

export function resolveBossSalary(job: Record<string, unknown>): string {
  const candidates = [
    job.salaryDesc,
    job.salary,
    job.salaryName,
    job.salaryMonthText,
    job.payTypeDesc,
    job.salaryRangeDesc,
    job.jobSalaryDesc,
    job.performance,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const low = Number(job.lowSalary ?? job.lowSalaryDesc);
  const high = Number(job.highSalary ?? job.highSalaryDesc);
  if (low > 0 && high > 0) {
    const l = low > 1000 ? Math.round(low / 1000) : low;
    const h = high > 1000 ? Math.round(high / 1000) : high;
    const month = job.salaryMonth;
    const base = `${l}-${h}K`;
    return typeof month === "number" && month > 12 ? `${base}·${month}薪` : base;
  }
  return "";
}

function decodeJsonStringLiteral(raw: string): string {
  let decoded = raw;
  try {
    decoded = JSON.parse(`"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
  } catch {
    decoded = raw;
  }
  return decoded.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/** 从页面 HTML / 内嵌 JSON 提取明文薪资 */
export function extractBossSalaryFromHtml(html: string): string {
  const patterns = [
    /"salaryDesc"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"salaryDesc"\s*:\s*'([^']+)'/,
    /\\"salaryDesc\\"\s*:\s*\\"((?:[^"\\]|\\.)*)\\"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const val = decodeJsonStringLiteral(match[1]).trim();
      if (/\d/.test(val) && /[Kk]|薪|万/.test(val)) return val;
    }
  }

  const low = html.match(/"lowSalary"\s*:\s*(\d+)/);
  const high = html.match(/"highSalary"\s*:\s*(\d+)/);
  const month = html.match(/"salaryMonth"\s*:\s*(\d+)/);
  if (low && high) {
    const l = Math.round(Number(low[1]) / 1000);
    const h = Math.round(Number(high[1]) / 1000);
    if (l > 0 && h > 0) {
      let salary = `${l}-${h}K`;
      if (month && Number(month[1]) > 12) salary += `·${month[1]}薪`;
      return salary;
    }
  }

  const nearJob = html.match(
    /"jobName"\s*:\s*"[^"]*"[\s\S]{0,500}?"salaryDesc"\s*:\s*"([^"]+)"/
  );
  if (nearJob?.[1] && /\d/.test(nearJob[1])) return nearJob[1];

  return "";
}

export function extractBossJobInfoFromApi(data: {
  code?: number;
  zpData?: Record<string, unknown>;
}): Record<string, unknown> | null {
  if (data.code !== 0 || !data.zpData) return null;
  const job = data.zpData.jobInfo ?? data.zpData.job ?? data.zpData.detail;
  return job && typeof job === "object" ? (job as Record<string, unknown>) : null;
}

/** 从 detail.json / joblist.json 等 API 响应提取薪资 */
export function extractBossSalaryFromApiPayload(
  data: { code?: number; zpData?: Record<string, unknown> },
  encryptJobId?: string
): string {
  const job = extractBossJobInfoFromApi(data);
  if (job) {
    const salary = resolveBossSalary(job);
    if (salary) return salary;
  }

  const z = data.zpData;
  if (!z) return "";

  const lists = [z.jobList, z.jobs, z.list, z.recommendJobList].filter(Array.isArray) as Array<
    Array<Record<string, unknown>>
  >;
  for (const list of lists) {
    if (encryptJobId) {
      const matched = list.find(
        (item) =>
          item.encryptJobId === encryptJobId ||
          item.jobId === encryptJobId ||
          item.encryptId === encryptJobId
      );
      if (matched) {
        const salary = resolveBossSalary(matched);
        if (salary) return salary;
      }
    }
    for (const item of list) {
      const salary = resolveBossSalary(item);
      if (salary) return salary;
    }
  }

  return extractBossSalaryFromHtml(JSON.stringify(z));
}

export function findBossCachedApiUrls(entries: { name: string }[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const url = entries[i].name;
    if (
      !/\/wapi\/zpgeek\/(job\/(detail|card|preview)\.json|search\/joblist\.json)/i.test(url)
    ) {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function buildBossDetailApiUrls(ids: BossPageIds): string[] {
  const urls: string[] = [];
  const primary = buildBossDetailApiUrl(ids);
  if (primary) urls.push(primary);
  if (ids.encryptJobId && !ids.securityId) {
    urls.push(
      `/wapi/zpgeek/job/detail.json?encryptJobId=${encodeURIComponent(ids.encryptJobId)}`
    );
    urls.push(`/wapi/zpgeek/job/detail.json?jobId=${encodeURIComponent(ids.encryptJobId)}`);
  }
  return urls;
}

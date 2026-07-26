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

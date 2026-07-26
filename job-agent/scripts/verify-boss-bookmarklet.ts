import {
  buildBossDetailApiUrl,
  extractBossIdsFromHtml,
  extractBossIdsFromPerformance,
  extractBossIdsFromSearch,
  findBossDetailApiUrl,
  mergeBossPageIds,
  parseBossJobPath,
  resolveBossSalary,
} from "../src/lib/boss-page-resolver";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const perfEntries = [
  {
    name: "https://www.zhipin.com/wapi/zpgeek/job/detail.json?securityId=abc123XYZ&lid=talk.l.1&encryptJobId=job999",
  },
];

assert(parseBossJobPath("/job_detail/cbcbfca3f1a2.html") === "cbcbfca3f1a2", "path job id");

const fromSearch = extractBossIdsFromSearch("?jobId=job999");
assert(fromSearch.encryptJobId === "job999", "search job id");

const fromPerf = extractBossIdsFromPerformance(perfEntries);
assert(fromPerf.securityId === "abc123XYZ", "performance securityId");
assert(fromPerf.lid === "talk.l.1", "performance lid");

const cached = findBossDetailApiUrl(perfEntries);
assert(!!cached && cached.includes("securityId=abc123XYZ"), "cached detail url");

const fromHtml = extractBossIdsFromHtml(
  '{"securityId":"nbyXZvE4kfp6Y-test","encryptJobId":"cbcbfca3","lid":"8"}'
);
assert(fromHtml.securityId === "nbyXZvE4kfp6Y-test", "html securityId");

const merged = mergeBossPageIds(fromSearch, fromPerf, fromHtml);
assert(merged.securityId === "abc123XYZ", "merged ids prefer performance");
assert(merged.encryptJobId === "job999", "merged encrypt job id");

const apiUrl = buildBossDetailApiUrl(merged);
assert(!!apiUrl && apiUrl.includes("securityId=abc123XYZ"), "detail api url");
assert(!!apiUrl && apiUrl.includes("encryptJobId=job999"), "detail api includes job id");

assert(resolveBossSalary({ salaryDesc: "12-18K" }) === "12-18K", "salary desc");
assert(resolveBossSalary({ salary: "15K" }) === "15K", "salary fallback");
assert(resolveBossSalary({ lowSalary: 15000, highSalary: 25000, salaryMonth: 16 }) === "15-25K·16薪", "low/high salary");

console.log("OK: boss bookmarklet resolver verified");

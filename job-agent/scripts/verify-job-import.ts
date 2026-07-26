import { detectJobSourceFromUrl, getJobSourceLabel, resolveJobSource } from "../src/lib/job-source";
import { parseXiaohongshuPositionId, importXiaohongshuJob } from "../src/lib/job-importers/xiaohongshu";

async function main() {
  const url = "https://job.xiaohongshu.com/social/position/18746";
  const id = parseXiaohongshuPositionId(url);
  if (id !== "18746") {
    console.error("FAIL: parse xhs position id", id);
    process.exit(1);
  }

  if (detectJobSourceFromUrl(url) !== "xiaohongshu") {
    console.error("FAIL: detect xhs source");
    process.exit(1);
  }

  if (getJobSourceLabel("boss") !== "BOSS直聘") {
    console.error("FAIL: source label");
    process.exit(1);
  }

  if (resolveJobSource({ url: "https://www.zhipin.com/job_detail/xxx.html" }) !== "boss") {
    console.error("FAIL: resolve boss from url");
    process.exit(1);
  }

  const draft = await importXiaohongshuJob(url, "18746");
  if (!draft.title.includes("用户研究") && !draft.title.includes("User Research")) {
    console.error("FAIL: xhs title", draft.title);
    process.exit(1);
  }
  if (draft.company !== "小红书") {
    console.error("FAIL: xhs company", draft.company);
    process.exit(1);
  }
  if ((draft.responsibilities?.length ?? 0) < 3) {
    console.error("FAIL: xhs responsibilities", draft.responsibilities?.length);
    process.exit(1);
  }
  if ((draft.requirements?.length ?? 0) < 3) {
    console.error("FAIL: xhs requirements", draft.requirements?.length);
    process.exit(1);
  }
  if (draft.experienceYears != null) {
    console.error("FAIL: xhs should not infer experienceYears without JD text", draft.experienceYears);
    process.exit(1);
  }

  console.log("OK: job source + xiaohongshu import verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

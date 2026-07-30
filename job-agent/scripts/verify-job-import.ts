import { detectJobSourceFromUrl } from "../src/lib/job-source";
import { parseLiepinJobId, importLiepinJob } from "../src/lib/job-importers/liepin";
import { parseXiaohongshuPositionId, importXiaohongshuJob } from "../src/lib/job-importers/xiaohongshu";

const LIEPIN_URL =
  "https://www.liepin.com/job/1984054575.shtml?pgRef=c_pc_apply_page%3Ac_pc_apply_all_job_listcard%402_84054575%3A1%3Acd059ebf-be90-439b-98f8-3e75fe760bf8&d_sfrom=recom_apply_list";

async function main() {
  const liepinId = parseLiepinJobId(LIEPIN_URL);
  if (liepinId !== "1984054575") {
    console.error("FAIL: parse liepin job id", liepinId);
    process.exit(1);
  }

  if (detectJobSourceFromUrl(LIEPIN_URL) !== "liepin") {
    console.error("FAIL: detect liepin source");
    process.exit(1);
  }

  const draft = await importLiepinJob(LIEPIN_URL, "1984054575");
  if (!draft.title.includes("用户研究")) {
    console.error("FAIL: liepin title", draft.title);
    process.exit(1);
  }
  if (draft.company !== "字节跳动") {
    console.error("FAIL: liepin company", draft.company);
    process.exit(1);
  }
  if (!draft.salary?.match(/15-30K|20-40K/i)) {
    console.error("FAIL: liepin salary", draft.salary);
    process.exit(1);
  }
  if ((draft.responsibilities?.length ?? 0) < 2) {
    console.error("FAIL: liepin responsibilities", draft.responsibilities?.length);
    process.exit(1);
  }
  if ((draft.requirements?.length ?? 0) < 2) {
    console.error("FAIL: liepin requirements", draft.requirements?.length);
    process.exit(1);
  }
  if (draft.platformExperienceLabel !== "1-8年") {
    console.error("FAIL: liepin platform tag", draft.platformExperienceLabel);
    process.exit(1);
  }
  if (draft.experienceYears !== 1) {
    console.error("FAIL: liepin jd experience years", draft.experienceYears);
    process.exit(1);
  }

  const xhsUrl = "https://job.xiaohongshu.com/social/position/18746";
  const xhsId = parseXiaohongshuPositionId(xhsUrl);
  if (xhsId !== "18746") {
    console.error("FAIL: parse xhs position id", xhsId);
    process.exit(1);
  }

  const xhsDraft = await importXiaohongshuJob(xhsUrl, "18746");
  if (xhsDraft.company !== "小红书") {
    console.error("FAIL: xhs company", xhsDraft.company);
    process.exit(1);
  }

  console.log("OK: job import (liepin + xiaohongshu) verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

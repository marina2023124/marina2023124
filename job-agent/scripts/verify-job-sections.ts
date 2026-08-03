import { parseJobDescription } from "../src/lib/jd-parser";
import { assembleJobDescription, getJobSections } from "../src/lib/job-sections";

const text = `岗位：类目运营
职位描述
行业研究 行业调研

岗位职责
一、行研与规划：搭建行业研究方法论
二、数据与策略：搭建评估指标体系
三、产品与规划：参与信息产品落地
四、协同与执行：跨部门协同

岗位要求
一、经验背景：本科以上
二、研究有体系：研究框架
三、数据能驱动：SQL/Excel
四、产品运营sense：熟悉LLM
五、沟通有力量：跨部门协同`;

const parsed = parseJobDescription(text);
const saved = {
  id: "1",
  title: parsed.title,
  company: parsed.company,
  description: assembleJobDescription(parsed),
  preferredSkills: parsed.preferredSkills,
  responsibilities: parsed.responsibilities,
  requirements: parsed.requirements,
  status: "saved" as const,
  createdAt: "",
};

const sections = getJobSections({ ...saved, jobIntro: undefined });
if (sections.responsibilities.length !== 4) {
  console.error("FAIL: expected 4 responsibilities", sections.responsibilities.length);
  process.exit(1);
}
if (sections.requirements.length !== 5) {
  console.error("FAIL: expected 5 requirements", sections.requirements.length);
  process.exit(1);
}
if (!sections.jobIntro?.includes("行业研究")) {
  console.error("FAIL: jobIntro should backfill from description", sections.jobIntro);
  process.exit(1);
}

console.log("OK: job sections display data complete");

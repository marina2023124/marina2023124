import type { JobPosting } from "../src/lib/types";
import {
  applyJobListPrefs,
  filterJobs,
  getJobIndustry,
  parseSalarySortValue,
  sortJobs,
} from "../src/lib/job-list";

const sampleJobs: JobPosting[] = [
  {
    id: "1",
    title: "类目运营",
    company: "某电商公司",
    salary: "15-20K·15薪",
    industry: "电商",
    experienceYears: 2,
    interestRating: 4,
    description: "",
    requirements: [],
    preferredSkills: [],
    status: "saved",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "2",
    title: "用户研究员",
    company: "某互联网公司",
    salary: "25-35K·16薪",
    industry: "互联网",
    experienceYears: 3,
    interestRating: 5,
    description: "",
    requirements: [],
    preferredSkills: [],
    status: "saved",
    createdAt: "2026-07-10T10:00:00.000Z",
  },
  {
    id: "3",
    title: "商业分析师",
    company: "某教育公司",
    salary: "11-20K·14薪",
    experienceYears: 1,
    interestRating: 2,
    description: "教育行业用户研究",
    requirements: [],
    preferredSkills: [],
    status: "applied",
    createdAt: "2026-06-20T10:00:00.000Z",
  },
];

if (parseSalarySortValue("15-20K·15薪") <= parseSalarySortValue("11-20K·14薪")) {
  console.error("FAIL: salary parse should rank 15-20K·15薪 higher");
  process.exit(1);
}

const bySalary = sortJobs(sampleJobs, "salary", "desc").map((j) => j.id);
if (bySalary[0] !== "2") {
  console.error("FAIL: salary sort desc", bySalary);
  process.exit(1);
}

const byInterest = sortJobs(sampleJobs, "interestRating", "desc").map((j) => j.id);
if (byInterest[0] !== "2") {
  console.error("FAIL: interest sort desc", byInterest);
  process.exit(1);
}

const filtered = filterJobs(sampleJobs, { minInterest: 4, industry: "互联网" });
if (filtered.length !== 1 || filtered[0]?.id !== "2") {
  console.error("FAIL: interest + industry filter", filtered.map((j) => j.id));
  process.exit(1);
}

if (getJobIndustry(sampleJobs[2]!) !== "教育") {
  console.error("FAIL: infer industry from description", getJobIndustry(sampleJobs[2]!));
  process.exit(1);
}

const applied = applyJobListPrefs(sampleJobs, {
  sortField: "createdAt",
  sortOrder: "desc",
  filters: { status: "saved" },
});
if (applied.length !== 2 || applied[0]?.id !== "2") {
  console.error("FAIL: apply prefs", applied.map((j) => j.id));
  process.exit(1);
}

console.log("OK: job list sort/filter/rating utilities verified");

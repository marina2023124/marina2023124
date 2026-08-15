import { defaultAppData } from "../src/lib/types";
import {
  buildPersonalCareerBackup,
  countConfidentialChats,
  inventoryCareerAssets,
  looksInternalConfidential,
} from "../src/lib/offboard";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const emptyFindings = inventoryCareerAssets(defaultAppData());
assert(
  emptyFindings.some((item) => item.id === "empty"),
  "empty archive should be flagged"
);

const data = defaultAppData();
data.profile.name = "Marina";
data.profile.email = "marina@example.com";
data.profile.educations = [
  {
    id: "e1",
    school: "某大学",
    degree: "本科",
    field: "传播学",
    startDate: "2018-09",
    endDate: "2022-06",
  },
];
data.profile.skills = [{ id: "s1", name: "用户访谈", level: "advanced" }];
data.profile.workExperiences = [
  {
    id: "w1",
    company: "示例公司",
    title: "用户研究员",
    startDate: "2023-07",
    description: "用研",
    achievements: ["完成可用性测试"],
    skills: ["访谈"],
  },
];
data.profile.projects = [
  {
    id: "p1",
    name: "对外作品集项目",
    description: "公开案例",
    technologies: [],
    highlights: ["提升转化"],
  },
  {
    id: "p2",
    name: "内部项目",
    description: "本周完成 WK28 周报对齐",
    technologies: [],
    highlights: ["下周计划推进未公开指标"],
    projectId: "2406303",
  },
];
data.jobs = [
  {
    id: "j1",
    title: "用户研究专家",
    company: "目标公司",
    description: "公开招聘",
    requirements: [],
    preferredSkills: [],
    status: "applied",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];
data.chatHistory = [
  {
    id: "c1",
    role: "user",
    content: "2024.6.24-6.28 周报\n本周完成内部项目对齐\n下周计划继续推进",
    timestamp: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "c2",
    role: "assistant",
    content: "可以把成果改写成简历要点。",
    timestamp: "2026-08-01T00:00:01.000Z",
  },
];

assert(looksInternalConfidential(data.chatHistory[0].content), "weekly chat is confidential");
assert(countConfidentialChats(data.chatHistory) >= 1, "counts confidential chats");

const findings = inventoryCareerAssets(data);
assert(findings.some((item) => item.id === "profile" && item.bucket === "backup"), "profile backup");
assert(findings.some((item) => item.id === "education" && item.bucket === "backup"), "education backup");
assert(findings.some((item) => item.id === "jobs" && item.bucket === "backup"), "jobs backup");
assert(
  findings.some((item) => item.id === "projects" && item.bucket === "do-not-take"),
  "internal projects should not be taken wholesale"
);
assert(
  findings.some((item) => item.id === "chats" && item.bucket === "do-not-take"),
  "chats should not be exported by default"
);

const backup = buildPersonalCareerBackup(data);
assert(backup.payload.chatHistory.length === 0, "personal backup strips chats");
assert(backup.payload.profile.name === "Marina", "keeps personal profile");
assert(backup.payload.jobs.length === 1, "keeps job search records");
assert(backup.payload.exportedFor === "personal-device", "marks destination");
assert(backup.excludedChatCount === 2, "reports excluded chats");
assert(backup.warnings.length > 0, "warns about internal material");
assert(backup.filename.startsWith("job-agent-personal-backup-"), "backup filename");

console.log("OK: offboard inventory verified");

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface Skill {
  id: string;
  name: string;
  level: SkillLevel;
  category?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description: string;
  achievements: string[];
  skills: string[];
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  highlights: string[];
  url?: string;
  /** One-sentence summary of highlights for resume display */
  workSummary?: string;
  /** 项目编号，如 2406303 */
  projectId?: string;
  /** 启动日期 YYYY-MM-DD */
  startDate?: string;
  /** 结束日期 YYYY-MM-DD */
  endDate?: string;
  /** 项目周期（天） */
  durationDays?: number;
  /** ongoing = 进行中 */
  status?: "ongoing" | "completed";
  /** 所属工作经历 ID（按项目时间自动匹配） */
  workExperienceId?: string;
  /** 项目标签，如 P0、P1 优先级 */
  tags?: string[];
}

export interface Profile {
  name: string;
  email: string;
  phone?: string;
  summary: string;
  targetRoles: string[];
  targetIndustries: string[];
  preferredLocations: string[];
  expectedSalary?: { min: number; max: number; currency: string };
  workExperiences: WorkExperience[];
  educations: Education[];
  projects: Project[];
  skills: Skill[];
}

export type JobStatus = "saved" | "applied" | "interview" | "rejected" | "offer";

import type { JobSource } from "./job-source";
export type { JobSource } from "./job-source";

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location?: string;
  workAddress?: string;
  salary?: string;
  /** 职位描述：工时、福利、标签等 */
  jobIntro?: string;
  /** 岗位职责条目 */
  responsibilities?: string[];
  description: string;
  requirements: string[];
  preferredSkills: string[];
  experienceYears?: number;
  /** 平台筛选项经验标签（如小红书 3-5年），非 JD 正文硬性要求 */
  platformExperienceLabel?: string;
  /** 所属行业（可手动填写或由 JD 推断） */
  industry?: string;
  /** 个人意愿度 1-5 星，0 或未设置表示未标记 */
  interestRating?: number;
  /** 岗位信息来源渠道 */
  source?: JobSource;
  url?: string;
  status: JobStatus;
  createdAt: string;
}

export interface MatchResult {
  jobId: string;
  score: number;
  skillMatch: number;
  experienceMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  /** 与岗位相关的项目经历及匹配原因 */
  matchedProjects: MatchedProject[];
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export interface MatchedProject {
  id: string;
  name: string;
  /** 项目成果一句话描述 */
  summary: string;
  /** 具体匹配原因（完整句子） */
  reasons: string[];
  /** 所属工作经历，如「数说故事 · 商业分析师」 */
  workExperienceLabel: string;
  workExperienceId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AppData {
  profile: Profile;
  jobs: JobPosting[];
  chatHistory: ChatMessage[];
}

export const emptyProfile = (): Profile => ({
  name: "",
  email: "",
  summary: "",
  targetRoles: [],
  targetIndustries: [],
  preferredLocations: [],
  workExperiences: [],
  educations: [],
  projects: [],
  skills: [],
});

export const defaultAppData = (): AppData => ({
  profile: emptyProfile(),
  jobs: [],
  chatHistory: [],
});

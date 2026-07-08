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

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location?: string;
  workAddress?: string;
  salary?: string;
  description: string;
  requirements: string[];
  preferredSkills: string[];
  experienceYears?: number;
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
  strengths: string[];
  gaps: string[];
  recommendation: string;
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

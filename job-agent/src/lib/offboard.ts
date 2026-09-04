import type { AppData, ChatMessage, Profile } from "./types";
import { defaultAppData } from "./types";
import { isWeeklyReportText } from "./weekly-report-parser";

export type OffboardBucket = "backup" | "clean" | "do-not-take";
export type OffboardRisk = "low" | "medium" | "high";

export interface OffboardFinding {
  id: string;
  bucket: OffboardBucket;
  title: string;
  detail: string;
  count?: number;
  samples?: string[];
  action?: string;
  risk: OffboardRisk;
}

export interface PersonalBackupResult {
  filename: string;
  payload: AppData & { exportedAt: string; exportedFor: "personal-device" };
  warnings: string[];
  excludedChatCount: number;
}

const INTERNAL_HINT =
  /周报|本周完成|下周计划|内部|保密|未公开|WK\s*\d|项目编号|对齐会|复盘会|OKR|KPI/i;

export function looksInternalConfidential(text: string): boolean {
  if (!text.trim()) return false;
  return isWeeklyReportText(text) || INTERNAL_HINT.test(text.slice(0, 4000));
}

export function countConfidentialChats(messages: ChatMessage[]): number {
  return messages.filter((message) => looksInternalConfidential(message.content)).length;
}

export function countConfidentialProjects(profile: Profile): number {
  return profile.projects.filter((project) => {
    const blob = [project.name, project.description, ...(project.highlights || [])].join("\n");
    return looksInternalConfidential(blob) || Boolean(project.projectId && /^\d{6,7}$/.test(project.projectId));
  }).length;
}

/** 个人求职资产备份：默认去掉顾问对话（常含粘贴的周报/内部材料） */
export function buildPersonalCareerBackup(data: AppData): PersonalBackupResult {
  const confidentialChats = countConfidentialChats(data.chatHistory);
  const confidentialProjects = countConfidentialProjects(data.profile);
  const warnings: string[] = [];

  if (data.chatHistory.length > 0) {
    warnings.push(
      confidentialChats > 0
        ? `已排除 ${data.chatHistory.length} 条顾问对话（其中 ${confidentialChats} 条像周报/内部材料）。`
        : `已排除 ${data.chatHistory.length} 条顾问对话，避免把工作电脑上的聊天记录带走。`
    );
  }
  if (confidentialProjects > 0) {
    warnings.push(
      `有 ${confidentialProjects} 个项目含周报口吻或内部项目编号。带走前请改成可公开的履历表述，不要复制未公开数据。`
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `job-agent-personal-backup-${date}.json`,
    payload: {
      ...data,
      chatHistory: [],
      exportedAt: new Date().toISOString(),
      exportedFor: "personal-device",
    },
    warnings,
    excludedChatCount: data.chatHistory.length,
  };
}

export function inventoryCareerAssets(data: AppData): OffboardFinding[] {
  const { profile, jobs, chatHistory } = data;
  const confidentialChats = countConfidentialChats(chatHistory);
  const confidentialProjects = countConfidentialProjects(profile);
  const applied = jobs.filter((job) => job.status === "applied" || job.status === "interview" || job.status === "offer");
  const findings: OffboardFinding[] = [];

  if (profile.name || profile.email || profile.phone || profile.summary) {
    findings.push({
      id: "profile",
      bucket: "backup",
      title: "个人基本信息",
      detail: "姓名、联系方式、求职意向。保存到个人网盘或手机，不要留在归还的工作电脑上。",
      samples: [profile.name, profile.email, profile.phone].filter(Boolean) as string[],
      action: "下载个人求职备份",
      risk: "medium",
    });
  }

  if (profile.educations.length > 0) {
    findings.push({
      id: "education",
      bucket: "backup",
      title: "教育背景",
      detail: "学历信息属于个人材料，应备份到个人设备。",
      count: profile.educations.length,
      samples: profile.educations.map((edu) => `${edu.school} · ${edu.field || edu.degree}`).slice(0, 3),
      action: "下载个人求职备份",
      risk: "low",
    });
  }

  if (profile.skills.length > 0) {
    findings.push({
      id: "skills",
      bucket: "backup",
      title: "技能标签",
      detail: "你整理过的技能清单，可直接用于下一份简历。",
      count: profile.skills.length,
      samples: profile.skills.map((skill) => skill.name).slice(0, 6),
      action: "下载个人求职备份",
      risk: "low",
    });
  }

  if (profile.workExperiences.length > 0) {
    findings.push({
      id: "work",
      bucket: "backup",
      title: "工作经历（履历表述）",
      detail: "你自己写的职责与成果可以带走。若含未公开指标、客户名或内部黑话，请先改成对外履历口径。",
      count: profile.workExperiences.length,
      samples: profile.workExperiences.map((exp) => `${exp.company} · ${exp.title}`).slice(0, 4),
      action: "下载个人求职备份",
      risk: "medium",
    });
  }

  if (profile.projects.length > 0) {
    findings.push({
      id: "projects",
      bucket: confidentialProjects > 0 ? "do-not-take" : "backup",
      title: confidentialProjects > 0 ? "项目经历（含疑似内部材料）" : "项目经历",
      detail:
        confidentialProjects > 0
          ? "部分项目像从周报导入，可能含内部编号或未公开进展。只保留可写进简历的一句话成果，不要整份带走。"
          : "项目成果可用于简历。带走前确认没有未公开数据。",
      count: profile.projects.length,
      samples: profile.projects.map((project) => project.name).filter(Boolean).slice(0, 4),
      action: confidentialProjects > 0 ? "先改写成履历表述再备份" : "下载个人求职备份",
      risk: confidentialProjects > 0 ? "high" : "medium",
    });
  }

  if (jobs.length > 0) {
    findings.push({
      id: "jobs",
      bucket: "backup",
      title: "求职岗位与投递进度",
      detail: "你收藏/投递的 JD 和进度属于个人求职记录。公开招聘信息可备份；内推或未公开岗位请自行判断。",
      count: jobs.length,
      samples: jobs.map((job) => `${job.company} · ${job.title}`).slice(0, 4),
      action: applied.length > 0 ? `${applied.length} 个已投递/面试/Offer 请优先带走` : "下载个人求职备份",
      risk: "low",
    });
  }

  if (chatHistory.length > 0) {
    findings.push({
      id: "chats",
      bucket: "do-not-take",
      title: "职业顾问对话",
      detail:
        confidentialChats > 0
          ? "对话里可能粘贴过周报或内部材料。默认备份不会导出这些聊天。"
          : "顾问聊天可能含工作细节。默认备份会排除对话，避免误带到个人设备。",
      count: chatHistory.length,
      action: "不要整段导出；需要的结论请自己改写成履历要点",
      risk: confidentialChats > 0 ? "high" : "medium",
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: "empty",
      bucket: "backup",
      title: "云端档案目前是空的",
      detail: "登录后仍无经历/岗位。请确认 VPN 与云端同步，或检查是否还在访客/离线模式。",
      risk: "low",
    });
  }

  return findings;
}

export const WORK_COMPUTER_CLEAN_LIST: OffboardFinding[] = [
  {
    id: "env-local",
    bucket: "clean",
    title: "JobAgent 密钥文件 .env.local",
    detail: "工作电脑 ~/marina2023124/job-agent/.env.local 可能含 Supabase / DeepSeek Key。归还电脑前必须删除，密钥到个人设备另行保存。",
    action: "bash scan-leave.sh 查看；确认备份后可加 --clean-job-agent",
    risk: "high",
    samples: [".env.local", ".env.local.bak"],
  },
  {
    id: "browser",
    bucket: "clean",
    title: "浏览器本地缓存与登录态",
    detail: "即使默认云端存储，离线模式或旧版仍可能留下 job-agent-data。退出登录并清除本页列出的浏览器残留。",
    action: "本页一键清除浏览器残留",
    risk: "high",
    samples: ["job-agent-data", "job-agent-offline", "登录 Cookie"],
  },
  {
    id: "local-backup-json",
    bucket: "clean",
    title: "工作电脑上的备份 JSON",
    detail: "下载过的 job-agent-backup-*.json 若还在「下载/桌面」，先拷到个人网盘，再从工作电脑删除。",
    action: "先拷走，再删工作电脑副本",
    risk: "high",
    samples: ["~/Downloads/job-agent-backup-*.json"],
  },
  {
    id: "miniprogram",
    bucket: "clean",
    title: "微信小程序登录 token",
    detail: "若用工作微信登录过 JobAgent 小程序，在小程序内退出，并确认工作微信里没有本地缓存。",
    action: "小程序退出登录",
    risk: "medium",
    samples: ["token", "app-data"],
  },
  {
    id: "dev-tools",
    bucket: "clean",
    title: "开发工具与云账号登录",
    detail: "Cursor、GitHub、Vercel、Supabase、DeepSeek 若在工作电脑登录过个人账号，先退出；公司账号按 IT 要求交还。",
    action: "退出个人账号；公司账号走离职流程",
    risk: "high",
    samples: ["Cursor", "gh auth", "SSH 密钥", "npm token"],
  },
  {
    id: "company-accounts",
    bucket: "clean",
    title: "公司系统与设备",
    detail: "邮箱、SSO、VPN、飞书/Slack、代码仓库、门禁与电脑本身按公司离职清单办理，不要自行拷走公司资产。",
    action: "走公司 IT / HR 清单",
    risk: "high",
  },
];

export const DO_NOT_TAKE_LIST: OffboardFinding[] = [
  {
    id: "weekly-source",
    bucket: "do-not-take",
    title: "周报、复盘、内部文档原文",
    detail: "周报 PDF/Excel、项目编号表、未公开数据属于公司材料。可以在自己脑海里记住能力与成果，不要拷贝原文。",
    risk: "high",
    samples: ["*周报*", "*复盘*", "WK28", "内部 OKR"],
  },
  {
    id: "company-code",
    bucket: "do-not-take",
    title: "公司代码、设计稿、数据",
    detail: "公司仓库、Figma、数据看板、客户资料不得带到个人 GitHub / 网盘。本仓库 marina2023124 是个人项目，可保留。",
    risk: "high",
  },
  {
    id: "company-secrets",
    bucket: "do-not-take",
    title: "公司密钥与内网凭证",
    detail: "公司 API Key、证书、VPN 配置、生产数据库地址离职后必须作废，不能转到下一家公司使用。",
    risk: "high",
  },
];

export const ACCOUNT_CHECKLIST: { title: string; detail: string; keep: boolean }[] = [
  { title: "JobAgent 云端（Supabase）", detail: "个人求职数据。备份后可继续用个人设备登录；工作电脑退出。", keep: true },
  { title: "DeepSeek API Key", detail: "个人密钥。从工作电脑 .env.local 删掉，需要的话在个人电脑重新配置。", keep: true },
  { title: "GitHub marina2023124", detail: "个人仓库。工作电脑退出 gh / git 登录，密钥不要留在归还设备上。", keep: true },
  { title: "微信小程序", detail: "个人微信可继续用；工作微信退出并清缓存。", keep: true },
  { title: "公司邮箱 / SSO / VPN", detail: "按 IT 交还，不要转发公司邮件到私人邮箱。", keep: false },
  { title: "公司代码平台与设计工具", detail: "GitLab/GitHub org、Figma、飞书文档等公司账号停用。", keep: false },
];

export const MAC_SCAN_COMMAND = `cd ~/marina2023124/job-agent
bash scan-leave.sh`;

export const BROWSER_WIPE_SNIPPET = `["job-agent-offline","job-agent-offline-explicit","job-agent-cloud-mode","job-agent-guest-mode","job-agent-data","job-agent-guest-data","job-agent-session-data"].forEach((k)=>{localStorage.removeItem(k);sessionStorage.removeItem(k);});
document.cookie="job-agent-offline=; path=/; max-age=0; SameSite=Lax";
document.cookie="job-agent-guest-mode=; path=/; max-age=0; SameSite=Lax";
location.href="/login";`;

export function emptyBackupTemplate(): AppData {
  return defaultAppData();
}

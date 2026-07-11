import type { AppData } from "./types";
import { defaultAppData } from "./types";
import { sanitizeWorkExperienceSkills, sanitizeProfileSkills } from "./skill-tags";
import { sanitizeProfileProjects } from "./utils";

export const LOCAL_MODE_KEY = "job-agent-offline";
export const CLOUD_MODE_KEY = "job-agent-cloud-mode";
const DATA_KEY = "job-agent-data";
const LEGACY_SESSION_DATA_KEY = "job-agent-session-data";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function wantsCloudMode(): boolean {
  return readStorage(CLOUD_MODE_KEY) === "1";
}

export function enableCloudMode(): void {
  writeStorage(CLOUD_MODE_KEY, "1");
  removeStorage(LOCAL_MODE_KEY);
  if (typeof document !== "undefined") {
    document.cookie = "job-agent-offline=; path=/; max-age=0; SameSite=Lax";
  }
}

export function disableCloudMode(): void {
  removeStorage(CLOUD_MODE_KEY);
}

export function isLocalModeEnabled(): boolean {
  return readStorage(LOCAL_MODE_KEY) === "1";
}

export function enableLocalMode(): void {
  writeStorage(LOCAL_MODE_KEY, "1");
  if (typeof document !== "undefined") {
    document.cookie = "job-agent-offline=1; path=/; max-age=31536000; SameSite=Lax";
  }
}

export function disableLocalMode(): void {
  removeStorage(LOCAL_MODE_KEY);
  removeStorage(DATA_KEY);
  removeStorage(LEGACY_SESSION_DATA_KEY);
  if (typeof document !== "undefined") {
    document.cookie = "job-agent-offline=; path=/; max-age=0; SameSite=Lax";
  }
}

/** 尝试从旧 sessionStorage 迁移到 localStorage */
function migrateLegacySessionData(): AppData | null {
  if (typeof window === "undefined") return null;
  const legacy = sessionStorage.getItem(LEGACY_SESSION_DATA_KEY);
  if (!legacy) return null;
  try {
    const parsed = { ...defaultAppData(), ...(JSON.parse(legacy) as AppData) };
    writeStorage(DATA_KEY, JSON.stringify(parsed));
    sessionStorage.removeItem(LEGACY_SESSION_DATA_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function loadLocalData(): AppData {
  try {
    const raw = readStorage(DATA_KEY);
    if (raw) {
      const data = { ...defaultAppData(), ...(JSON.parse(raw) as AppData) };
      return {
        ...data,
        profile: {
          ...data.profile,
          skills: sanitizeProfileSkills(data.profile.skills),
          workExperiences: data.profile.workExperiences.map((exp) =>
            sanitizeWorkExperienceSkills(exp)
          ),
          projects: sanitizeProfileProjects(
            data.profile.projects,
            data.profile.workExperiences
          ),
        },
      };
    }
    const migrated = migrateLegacySessionData();
    if (migrated) return migrated;
    return defaultAppData();
  } catch {
    return defaultAppData();
  }
}

export function saveLocalData(data: AppData): void {
  writeStorage(DATA_KEY, JSON.stringify(data));
}

export function hasLocalData(): boolean {
  const data = loadLocalData();
  return data.jobs.length > 0 || data.profile.workExperiences.length > 0;
}

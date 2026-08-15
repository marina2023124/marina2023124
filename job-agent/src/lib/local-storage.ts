import type { AppData } from "./types";
import { defaultAppData } from "./types";
import { createDemoAppData } from "./demo-data";
import { sanitizeWorkExperienceSkills, sanitizeProfileSkills } from "./skill-tags";
import { sanitizeProfileProjects } from "./utils";

export const LOCAL_MODE_KEY = "job-agent-offline";
export const CLOUD_MODE_KEY = "job-agent-cloud-mode";
export const OFFLINE_EXPLICIT_KEY = "job-agent-offline-explicit";
export const GUEST_MODE_KEY = "job-agent-guest-mode";
export const GUEST_MODE_COOKIE = "job-agent-guest-mode";
export const LOCAL_DATA_KEY = "job-agent-data";
export const GUEST_DATA_KEY = "job-agent-guest-data";
export const LEGACY_SESSION_DATA_KEY = "job-agent-session-data";
const DATA_KEY = LOCAL_DATA_KEY;

function setGuestModeCookie(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.cookie = `${GUEST_MODE_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = `${GUEST_MODE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function primeTryPageOffline(): void {
  if (typeof document === "undefined") return;
  document.cookie = "job-agent-offline=1; path=/; max-age=31536000; SameSite=Lax";
}

export const BROWSER_STORAGE_KEYS = [
  LOCAL_MODE_KEY,
  CLOUD_MODE_KEY,
  OFFLINE_EXPLICIT_KEY,
  GUEST_MODE_KEY,
  LOCAL_DATA_KEY,
  GUEST_DATA_KEY,
  LEGACY_SESSION_DATA_KEY,
] as const;

export const BROWSER_COOKIE_KEYS = ["job-agent-offline", "job-agent-guest-mode"] as const;

export interface BrowserResidueItem {
  key: string;
  location: "localStorage" | "sessionStorage" | "cookie";
  present: boolean;
  bytes: number;
}

function collectPrefixedKeys(storage: Storage, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** 扫描本机浏览器里 JobAgent 残留（不读取密钥内容） */
export function listBrowserResidue(): BrowserResidueItem[] {
  if (typeof window === "undefined") return [];

  const items: BrowserResidueItem[] = [];
  const seen = new Set<string>();

  const add = (key: string, location: BrowserResidueItem["location"], value: string | null) => {
    const id = `${location}:${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    items.push({
      key,
      location,
      present: value != null && value !== "",
      bytes: value ? value.length : 0,
    });
  };

  for (const key of new Set([
    ...BROWSER_STORAGE_KEYS,
    ...collectPrefixedKeys(localStorage, "job-agent-"),
  ])) {
    add(key, "localStorage", localStorage.getItem(key));
  }
  for (const key of new Set([
    ...BROWSER_STORAGE_KEYS,
    ...collectPrefixedKeys(sessionStorage, "job-agent-"),
  ])) {
    add(key, "sessionStorage", sessionStorage.getItem(key));
  }

  const cookieStr = document.cookie || "";
  for (const name of BROWSER_COOKIE_KEYS) {
    const match = cookieStr
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    add(name, "cookie", match ? match.slice(name.length + 1) : null);
  }

  return items;
}

/** 清除本机浏览器全部 JobAgent 痕迹（云端账号数据不受影响） */
export function wipeAllBrowserResidue(): void {
  if (typeof window === "undefined") return;
  for (const key of new Set([
    ...BROWSER_STORAGE_KEYS,
    ...collectPrefixedKeys(localStorage, "job-agent-"),
    ...collectPrefixedKeys(sessionStorage, "job-agent-"),
  ])) {
    removeStorage(key);
  }
  if (typeof document !== "undefined") {
    for (const name of BROWSER_COOKIE_KEYS) {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    }
  }
}

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
  if (isGuestMode()) return false;
  return readStorage(CLOUD_MODE_KEY) === "1";
}

export function isGuestMode(): boolean {
  return readStorage(GUEST_MODE_KEY) === "1";
}

export function enableCloudMode(): void {
  disableGuestMode();
  writeStorage(CLOUD_MODE_KEY, "1");
  removeStorage(LOCAL_MODE_KEY);
  removeStorage(OFFLINE_EXPLICIT_KEY);
  removeStorage(DATA_KEY);
  removeStorage(LEGACY_SESSION_DATA_KEY);
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
  writeStorage(OFFLINE_EXPLICIT_KEY, "1");
  removeStorage(CLOUD_MODE_KEY);
  if (typeof document !== "undefined") {
    document.cookie = "job-agent-offline=1; path=/; max-age=31536000; SameSite=Lax";
  }
}

export function disableLocalMode(): void {
  removeStorage(LOCAL_MODE_KEY);
  removeStorage(OFFLINE_EXPLICIT_KEY);
  removeStorage(DATA_KEY);
  removeStorage(LEGACY_SESSION_DATA_KEY);
  disableGuestMode();
  if (typeof document !== "undefined") {
    document.cookie = "job-agent-offline=; path=/; max-age=0; SameSite=Lax";
  }
}

/** 进入访客体验：独立存储，不读取账号本地/云端数据 */
export function enableGuestMode(withSampleData: boolean): void {
  writeStorage(GUEST_MODE_KEY, "1");
  setGuestModeCookie(true);
  enableLocalMode();
  removeStorage(DATA_KEY);
  removeStorage(LEGACY_SESSION_DATA_KEY);

  const data = withSampleData ? createDemoAppData() : defaultAppData();
  writeStorage(GUEST_DATA_KEY, JSON.stringify(normalizeStoredData(data)));
}

export function disableGuestMode(): void {
  removeStorage(GUEST_MODE_KEY);
  removeStorage(GUEST_DATA_KEY);
  setGuestModeCookie(false);
}

/** 清除本机求职资料缓存（云端登录前/退出后调用） */
export function clearLocalAppData(): void {
  removeStorage(DATA_KEY);
  removeStorage(LEGACY_SESSION_DATA_KEY);
}

function normalizeStoredData(data: AppData): AppData {
  return {
    ...data,
    profile: {
      ...data.profile,
      skills: sanitizeProfileSkills(data.profile.skills),
      workExperiences: data.profile.workExperiences.map((exp) =>
        sanitizeWorkExperienceSkills(exp)
      ),
      projects: sanitizeProfileProjects(data.profile.projects, data.profile.workExperiences),
    },
  };
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

function loadGuestData(): AppData {
  try {
    const raw = readStorage(GUEST_DATA_KEY);
    if (raw) {
      return normalizeStoredData({ ...defaultAppData(), ...(JSON.parse(raw) as AppData) });
    }
  } catch {
    // fall through
  }
  return normalizeStoredData(createDemoAppData());
}

export function loadLocalData(): AppData {
  if (isGuestMode()) {
    return loadGuestData();
  }

  try {
    const raw = readStorage(DATA_KEY);
    if (raw) {
      return normalizeStoredData({ ...defaultAppData(), ...(JSON.parse(raw) as AppData) });
    }
    const migrated = migrateLegacySessionData();
    if (migrated) return migrated;
    return defaultAppData();
  } catch {
    return defaultAppData();
  }
}

export function saveLocalData(data: AppData): void {
  const normalized = normalizeStoredData(data);
  if (isGuestMode()) {
    writeStorage(GUEST_DATA_KEY, JSON.stringify(normalized));
    return;
  }
  writeStorage(DATA_KEY, JSON.stringify(normalized));
}

export function hasLocalData(): boolean {
  const data = loadLocalData();
  return data.jobs.length > 0 || data.profile.workExperiences.length > 0;
}

/** 首屏是否走离线：访客模式或用户主动选择离线 */
export function shouldStartOffline(): boolean {
  if (typeof window === "undefined") return false;
  if (isGuestMode()) return true;
  return isLocalModeEnabled() && readStorage(OFFLINE_EXPLICIT_KEY) === "1";
}

/** 迁移旧版自动离线：未主动选择离线时默认云端 */
export function ensureCloudDefault(): void {
  if (typeof window === "undefined") return;
  if (isGuestMode()) return;
  if (readStorage(OFFLINE_EXPLICIT_KEY) === "1") return;
  if (isLocalModeEnabled() || !wantsCloudMode()) {
    enableCloudMode();
  }
}

/** 重置卡住的云端模式偏好（页面一直转圈时用） */
export function resetCloudPreference(): void {
  disableCloudMode();
  enableLocalMode();
}

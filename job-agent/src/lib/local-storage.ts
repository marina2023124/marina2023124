import type { AppData } from "./types";
import { defaultAppData } from "./types";

export const LOCAL_MODE_KEY = "job-agent-offline";
const DATA_KEY = "job-agent-session-data";

export function isLocalModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LOCAL_MODE_KEY) === "1";
}

export function enableLocalMode(): void {
  sessionStorage.setItem(LOCAL_MODE_KEY, "1");
}

export function disableLocalMode(): void {
  sessionStorage.removeItem(LOCAL_MODE_KEY);
  sessionStorage.removeItem(DATA_KEY);
}

export function loadLocalData(): AppData {
  try {
    const raw = sessionStorage.getItem(DATA_KEY);
    if (!raw) return defaultAppData();
    return { ...defaultAppData(), ...(JSON.parse(raw) as AppData) };
  } catch {
    return defaultAppData();
  }
}

export function saveLocalData(data: AppData): void {
  sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
}

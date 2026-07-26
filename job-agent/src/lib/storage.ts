"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppData, ChatMessage, JobPosting, Profile } from "./types";
import { defaultAppData } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import {
  clearLocalAppData,
  enableCloudMode,
  enableLocalMode,
  ensureCloudDefault,
  isLocalModeEnabled,
  loadLocalData,
  saveLocalData,
  shouldStartOffline,
} from "./local-storage";
import { sanitizeWorkExperienceSkills, sanitizeProfileSkills } from "./skill-tags";
import { profileProjectsNeedRepair } from "./project-match";
import { sanitizeProfileProjects } from "./utils";

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    skills: sanitizeProfileSkills(profile.skills),
    workExperiences: profile.workExperiences.map((exp) => sanitizeWorkExperienceSkills(exp)),
    projects: sanitizeProfileProjects(profile.projects, profile.workExperiences),
  };
}

const AUTH_TIMEOUT_MS = 8000;
const LOAD_TIMEOUT_MS = 15000;

interface BootstrapState {
  localMode: boolean;
  authReady: boolean;
  loaded: boolean;
  data: AppData;
}

function getBootstrapState(): BootstrapState {
  if (typeof window === "undefined") {
    return {
      localMode: false,
      authReady: false,
      loaded: false,
      data: defaultAppData(),
    };
  }

  ensureCloudDefault();

  if (shouldStartOffline()) {
    return {
      localMode: true,
      authReady: true,
      loaded: true,
      data: loadLocalData(),
    };
  }

  return {
    localMode: false,
    authReady: false,
    loaded: false,
    data: defaultAppData(),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function fetchSessionUser(): Promise<User | null> {
  const res = await fetch("/api/auth/session");
  if (!res.ok) return null;
  const body = (await res.json()) as { user?: { id: string; email?: string } | null };
  if (!body.user) return null;
  return { id: body.user.id, email: body.user.email } as User;
}

async function fetchCloudData(): Promise<AppData> {
  const res = await fetch("/api/cloud/data");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载失败 (${res.status})`);
  }
  return (await res.json()) as AppData;
}

async function persistCloudData(appData: AppData): Promise<void> {
  const res = await fetch("/api/cloud/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appData),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `保存失败 (${res.status})`);
  }
}

export function useAppData() {
  const bootstrapRef = useRef<BootstrapState | null>(null);
  if (!bootstrapRef.current) {
    bootstrapRef.current = getBootstrapState();
  }
  const bootstrap = bootstrapRef.current;
  const startedOffline = bootstrap.localMode;

  const [data, setData] = useState<AppData>(bootstrap.data);
  const [loaded, setLoaded] = useState(bootstrap.loaded);
  const [authReady, setAuthReady] = useState(bootstrap.authReady);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState(bootstrap.localMode);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    if (startedOffline) return;

    if (isLocalModeEnabled()) {
      setLocalMode(true);
      setData(loadLocalData());
      setAuthReady(true);
      setLoaded(true);
      return;
    }

    if (!isSupabaseConfigured()) {
      setAuthReady(true);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    withTimeout(fetchSessionUser(), AUTH_TIMEOUT_MS, "云端连接超时，请检查 VPN 或网络后刷新重试")
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .catch((err: Error) => {
        if (!cancelled) setSyncError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [startedOffline]);

  useEffect(() => {
    if (!authReady) return;

    if (localMode) {
      setData(loadLocalData());
      setLoaded(true);
      skipSaveRef.current = true;
      return;
    }

    if (!isSupabaseConfigured()) {
      setLoaded(true);
      return;
    }

    if (!user) {
      setData(defaultAppData());
      setLoaded(true);
      skipSaveRef.current = true;
      return;
    }

    let cancelled = false;
    setLoaded(false);
    setSyncError(null);

    withTimeout(fetchCloudData(), LOAD_TIMEOUT_MS, "云端加载超时，请检查本机服务能否连接 Supabase")
      .then((cloudData) => {
        if (!cancelled) {
          clearLocalAppData();
          const normalizedProfile = normalizeProfile(cloudData.profile);
          const needsRepair = profileProjectsNeedRepair(
            cloudData.profile.projects,
            normalizedProfile.projects
          );
          setData({
            ...cloudData,
            profile: normalizedProfile,
          });
          setLastSyncedAt(new Date().toISOString());
          skipSaveRef.current = !needsRepair;
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setSyncError(err.message);
      })
      .finally(() => {
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user, localMode]);

  useEffect(() => {
    if (!loaded || localMode) {
      if (localMode && loaded) {
        saveLocalData(data);
      }
      return;
    }

    if (!user || !isSupabaseConfigured()) return;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setSyncing(true);
      setSyncError(null);
      try {
        await persistCloudData(data);
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "同步失败");
      } finally {
        setSyncing(false);
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data, loaded, user, localMode]);

  const updateProfile = useCallback((profile: Partial<Profile>) => {
    setData((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...profile },
    }));
  }, []);

  const setProfile = useCallback((profile: Profile) => {
    setData((prev) => ({ ...prev, profile: normalizeProfile(profile) }));
  }, []);

  const addJob = useCallback((job: JobPosting) => {
    setData((prev) => ({ ...prev, jobs: [job, ...prev.jobs] }));
  }, []);

  const updateJob = useCallback((job: JobPosting) => {
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === job.id ? job : j)),
    }));
  }, []);

  const deleteJob = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.filter((j) => j.id !== id),
    }));
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setData((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, message],
    }));
  }, []);

  const replaceChatHistory = useCallback((chatHistory: ChatMessage[]) => {
    setData((prev) => ({ ...prev, chatHistory }));
  }, []);

  const clearChat = useCallback(() => {
    setData((prev) => ({ ...prev, chatHistory: [] }));
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-agent-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importData = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = {
            ...defaultAppData(),
            ...(JSON.parse(e.target?.result as string) as AppData),
          };
          setData(imported);

          if (user && isSupabaseConfigured()) {
            setSyncing(true);
            await persistCloudData(imported);
            setLastSyncedAt(new Date().toISOString());
            setSyncing(false);
          }
        } catch {
          alert("导入失败，请检查文件格式");
        }
      };
      reader.readAsText(file);
    },
    [user]
  );

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await fetch("/api/auth/logout", { method: "POST" });
    clearLocalAppData();
    setUser(null);
    setData(defaultAppData());
  }, []);

  const forceReady = useCallback(() => {
    setAuthReady(true);
    setLoaded(true);
  }, []);

  const enterCloudMode = useCallback(() => {
    enableCloudMode();
    clearLocalAppData();
    setLocalMode(false);
    setUser(null);
    setAuthReady(true);
    setLoaded(true);
    setSyncError(null);
    skipSaveRef.current = true;
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const enterLocalMode = useCallback(() => {
    enableLocalMode();
    setLocalMode(true);
    setUser(null);
    setData(loadLocalData());
    setAuthReady(true);
    setLoaded(true);
    skipSaveRef.current = true;
    setSyncError(null);
  }, []);

  return {
    data,
    loaded,
    authReady,
    user,
    syncing,
    syncError,
    lastSyncedAt,
    isConfigured: isSupabaseConfigured(),
    localMode,
    updateProfile,
    setProfile,
    addJob,
    updateJob,
    deleteJob,
    addChatMessage,
    replaceChatHistory,
    clearChat,
    exportData,
    importData,
    signOut,
    forceReady,
    enterLocalMode,
    enterCloudMode,
  };
}

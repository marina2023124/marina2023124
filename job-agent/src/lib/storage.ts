"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppData, ChatMessage, JobPosting, Profile } from "./types";
import { defaultAppData } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import { loadCloudData, saveCloudData } from "./cloud-storage";
import {
  enableCloudMode,
  enableLocalMode,
  isLocalModeEnabled,
  loadLocalData,
  saveLocalData,
  wantsCloudMode,
} from "./local-storage";
import { sanitizeWorkExperienceSkills } from "./skill-tags";

const AUTH_TIMEOUT_MS = 2500;
const LOAD_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    if (isLocalModeEnabled()) {
      setLocalMode(true);
      setData(loadLocalData());
      setAuthReady(true);
      setLoaded(true);
      return;
    }

    // 国内默认离线，避免一直等待 Supabase
    if (!wantsCloudMode()) {
      enableLocalMode();
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

    let done = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const finishAuth = (errorMessage?: string) => {
      if (!done) {
        done = true;
        if (errorMessage) setSyncError(errorMessage);
        setAuthReady(true);
      }
    };

    const authTimer = setTimeout(() => {
      if (done) return;
      enableLocalMode();
      setLocalMode(true);
      setUser(null);
      setData(loadLocalData());
      skipSaveRef.current = true;
      finishAuth("云端连接超时，已自动切换离线模式");
    }, AUTH_TIMEOUT_MS);

    try {
      const supabase = createClient();

      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          setUser(session?.user ?? null);
        })
        .catch(() => {
          setUser(null);
        })
        .finally(() => finishAuth());

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        finishAuth();
      });
      subscription = data.subscription;
    } catch (err) {
      finishAuth(err instanceof Error ? err.message : "Supabase 配置错误");
    }

    return () => {
      clearTimeout(authTimer);
      subscription?.unsubscribe();
    };
  }, []);

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

    const supabase = createClient();
    withTimeout(
      loadCloudData(supabase, user.id),
      LOAD_TIMEOUT_MS,
      "云端加载超时，请检查网络能否访问 supabase.co"
    )
      .then((cloudData) => {
        if (!cancelled) {
          setData({
            ...cloudData,
            profile: {
              ...cloudData.profile,
              workExperiences: cloudData.profile.workExperiences.map((exp) =>
                sanitizeWorkExperienceSkills(exp)
              ),
            },
          });
          setLastSyncedAt(new Date().toISOString());
          skipSaveRef.current = true;
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setSyncError(err.message);
      })
      .finally(() => {
        // 即使组件重渲染也必须结束 loading，避免永远转圈
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
        const supabase = createClient();
        await saveCloudData(supabase, user.id, data);
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
    setData((prev) => ({ ...prev, profile }));
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
            const supabase = createClient();
            await saveCloudData(supabase, user.id, imported);
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
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setData(defaultAppData());
  }, []);

  const forceReady = useCallback(() => {
    setAuthReady(true);
    setLoaded(true);
  }, []);

  const enterCloudMode = useCallback(() => {
    enableCloudMode();
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
    clearChat,
    exportData,
    importData,
    signOut,
    forceReady,
    enterLocalMode,
    enterCloudMode,
  };
}

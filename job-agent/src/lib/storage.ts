"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppData, ChatMessage, JobPosting, Profile } from "./types";
import { defaultAppData } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import { loadCloudData, saveCloudData } from "./cloud-storage";

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoaded(true);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    }).catch(() => {
      setUser(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
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
    loadCloudData(supabase, user.id)
      .then((cloudData) => {
        if (!cancelled) {
          setData(cloudData);
          setLastSyncedAt(new Date().toISOString());
          skipSaveRef.current = true;
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setSyncError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!loaded || !user || !isSupabaseConfigured()) return;

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
  }, [data, loaded, user]);

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

  return {
    data,
    loaded,
    user,
    syncing,
    syncError,
    lastSyncedAt,
    isConfigured: isSupabaseConfigured(),
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
  };
}

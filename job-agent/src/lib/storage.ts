"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppData, ChatMessage, JobPosting, Profile } from "./types";
import { defaultAppData } from "./types";

const STORAGE_KEY = "job-agent-data";

export function loadData(): AppData {
  if (typeof window === "undefined") return defaultAppData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppData();
    return { ...defaultAppData(), ...JSON.parse(raw) };
  } catch {
    return defaultAppData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setData(loadData());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveData(data);
  }, [data, loaded]);

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

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as AppData;
        setData({ ...defaultAppData(), ...imported });
      } catch {
        alert("导入失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    data,
    loaded,
    updateProfile,
    setProfile,
    addJob,
    updateJob,
    deleteJob,
    addChatMessage,
    clearChat,
    exportData,
    importData,
  };
}

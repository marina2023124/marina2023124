import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "./types";
import { defaultAppData } from "./types";

export async function loadCloudData(
  supabase: SupabaseClient,
  userId: string
): Promise<AppData> {
  const { data, error } = await supabase
    .from("user_app_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`加载云端数据失败：${error.message}`);
  }

  if (!data?.data) {
    return defaultAppData();
  }

  return { ...defaultAppData(), ...(data.data as AppData) };
}

export async function saveCloudData(
  supabase: SupabaseClient,
  userId: string,
  appData: AppData
): Promise<void> {
  const { error } = await supabase.from("user_app_data").upsert(
    {
      user_id: userId,
      data: appData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`保存到云端失败：${error.message}`);
  }
}

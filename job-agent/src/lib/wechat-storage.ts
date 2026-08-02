import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "./types";
import { defaultAppData } from "./types";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-project")) {
    throw new Error("未配置 Supabase Service Role（小程序云端同步需要）");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadWechatData(openid: string): Promise<AppData> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("wechat_user_data")
    .select("data")
    .eq("openid", openid)
    .maybeSingle();

  if (error) {
    throw new Error(`加载小程序数据失败：${error.message}`);
  }

  if (!data?.data) {
    return defaultAppData();
  }

  return { ...defaultAppData(), ...(data.data as AppData) };
}

export async function saveWechatData(openid: string, appData: AppData): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("wechat_user_data").upsert(
    {
      openid,
      data: appData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "openid" }
  );

  if (error) {
    throw new Error(`保存小程序数据失败：${error.message}`);
  }
}

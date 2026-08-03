import { randomInt } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "./types";
import { mergeAppDataForLink } from "./app-data-merge";
import { loadCloudData, saveCloudData } from "./cloud-storage";
import { loadWechatData, saveWechatData } from "./wechat-storage";

const BIND_CODE_TTL_MS = 10 * 60 * 1000;

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-project")) {
    throw new Error("未配置 Supabase Service Role");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function generateBindCodeValue(): string {
  return String(randomInt(100000, 999999));
}

export interface WechatLinkRecord {
  userId: string;
  openid: string;
  linkedAt: string;
}

export async function getLinkedUserId(openid: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("user_wechat_links")
    .select("user_id")
    .eq("openid", openid)
    .maybeSingle();

  if (error) throw new Error(`查询绑定关系失败：${error.message}`);
  return data?.user_id ?? null;
}

export async function getLinkedOpenid(userId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("user_wechat_links")
    .select("openid")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`查询绑定关系失败：${error.message}`);
  return data?.openid ?? null;
}

export async function getWechatLink(openid: string): Promise<WechatLinkRecord | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("user_wechat_links")
    .select("user_id, openid, linked_at")
    .eq("openid", openid)
    .maybeSingle();

  if (error) throw new Error(`查询绑定关系失败：${error.message}`);
  if (!data) return null;

  return {
    userId: data.user_id,
    openid: data.openid,
    linkedAt: data.linked_at,
  };
}

export async function createBindCode(userId: string): Promise<{ code: string; expiresAt: string }> {
  const supabase = getServiceClient();
  const expiresAt = new Date(Date.now() + BIND_CODE_TTL_MS).toISOString();

  await supabase.from("wechat_bind_codes").delete().eq("user_id", userId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateBindCodeValue();
    const { error } = await supabase.from("wechat_bind_codes").insert({
      code,
      user_id: userId,
      expires_at: expiresAt,
    });

    if (!error) {
      return { code, expiresAt };
    }
    if (error.code !== "23505") {
      throw new Error(`生成绑定码失败：${error.message}`);
    }
  }

  throw new Error("生成绑定码失败，请重试");
}

async function consumeBindCode(code: string): Promise<string | null> {
  const supabase = getServiceClient();
  const normalized = code.trim();
  const { data, error } = await supabase
    .from("wechat_bind_codes")
    .select("user_id, expires_at, used_at")
    .eq("code", normalized)
    .maybeSingle();

  if (error) throw new Error(`验证绑定码失败：${error.message}`);
  if (!data || data.used_at) return null;
  if (Date.parse(data.expires_at) < Date.now()) return null;

  const { error: updateError } = await supabase
    .from("wechat_bind_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", normalized)
    .is("used_at", null);

  if (updateError) throw new Error(`消费绑定码失败：${updateError.message}`);
  return data.user_id;
}

export async function bindWechatAccount(
  bindCode: string,
  openid: string
): Promise<{ userId: string; merged: boolean }> {
  const userId = await consumeBindCode(bindCode);
  if (!userId) {
    throw new Error("绑定码无效或已过期");
  }

  const supabase = getServiceClient();

  const { data: existingByOpenid } = await supabase
    .from("user_wechat_links")
    .select("user_id")
    .eq("openid", openid)
    .maybeSingle();

  if (existingByOpenid && existingByOpenid.user_id !== userId) {
    throw new Error("该微信已绑定其他网页账号");
  }

  const { data: existingByUser } = await supabase
    .from("user_wechat_links")
    .select("openid")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingByUser && existingByUser.openid !== openid) {
    throw new Error("该网页账号已绑定其他微信");
  }

  if (existingByOpenid?.user_id === userId) {
    return { userId, merged: false };
  }

  const webData = await loadCloudDataForUser(userId);
  const wechatData = await loadWechatData(openid);
  const mergedData = mergeAppDataForLink(webData, wechatData);

  await saveCloudDataForUser(userId, mergedData);
  await saveWechatData(openid, mergedData);

  const { error: linkError } = await supabase.from("user_wechat_links").upsert(
    {
      user_id: userId,
      openid,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (linkError) {
    throw new Error(`保存绑定关系失败：${linkError.message}`);
  }

  return { userId, merged: true };
}

async function loadCloudDataForUser(userId: string): Promise<AppData> {
  const supabase = getServiceClient();
  return loadCloudData(supabase, userId);
}

async function saveCloudDataForUser(userId: string, appData: AppData): Promise<void> {
  const supabase = getServiceClient();
  await saveCloudData(supabase, userId, appData);
}

/** 已绑定时，小程序侧统一读写网页云端数据 */
export async function loadLinkedAppData(openid: string): Promise<{
  data: AppData;
  linked: boolean;
  userId?: string;
}> {
  const userId = await getLinkedUserId(openid);
  if (!userId) {
    return { data: await loadWechatData(openid), linked: false };
  }

  const data = await loadCloudDataForUser(userId);
  return { data, linked: true, userId };
}

export async function saveLinkedAppData(openid: string, appData: AppData): Promise<{ linked: boolean }> {
  const userId = await getLinkedUserId(openid);
  if (!userId) {
    await saveWechatData(openid, appData);
    return { linked: false };
  }

  await saveCloudDataForUser(userId, appData);
  await saveWechatData(openid, appData);
  return { linked: true };
}

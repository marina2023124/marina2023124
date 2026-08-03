import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createBindCode } from "@/lib/wechat-link";

async function getLinkedOpenidForUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_wechat_links")
    .select("openid")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`查询绑定关系失败：${error.message}`);
  }

  return data?.openid ?? null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const openid = await getLinkedOpenidForUser(supabase, user.id);
    return NextResponse.json({
      linked: Boolean(openid),
      openid: openid ? `${openid.slice(0, 6)}…` : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const existing = await getLinkedOpenidForUser(supabase, user.id);
    if (existing) {
      return NextResponse.json({ error: "已绑定微信小程序，无需重复绑定" }, { status: 400 });
    }

    const { code, expiresAt } = await createBindCode(user.id);
    return NextResponse.json({
      code,
      expiresAt,
      expiresInMinutes: 10,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成绑定码失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { pingSupabaseProject, probeAuthTokenPost } from "@/lib/supabase/ping";
import { getServerProxyStatus, serverFetch } from "@/lib/supabase/server-fetch";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const proxy = getServerProxyStatus();

  if (!url || !anonKey || url.includes("your-project") || anonKey.includes("your-anon")) {
    return NextResponse.json({
      ok: false,
      message: "未配置 Supabase，请先完成 .env.local 设置",
      proxy,
    });
  }

  const result = await pingSupabaseProject(url, anonKey, serverFetch);
  const authPost = await probeAuthTokenPost(url, anonKey, serverFetch);

  return NextResponse.json({
    ok: result.ok && authPost.ok,
    message: result.ok && authPost.ok ? result.message : !result.ok ? result.message : authPost.message,
    health: result,
    authPost,
    proxy,
  });
}

import { NextResponse } from "next/server";
import { maskSupabaseUrl } from "@/lib/supabase/ping";
import { pingSupabaseProject, probeAuthTokenPost } from "@/lib/supabase/ping";
import { getServerProxyStatus, serverFetch } from "@/lib/supabase/server-fetch";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const proxy = getServerProxyStatus();
  const isVercel = Boolean(process.env.VERCEL);

  if (!url || !anonKey || url.includes("your-project") || anonKey.includes("your-anon")) {
    return NextResponse.json({
      ok: false,
      issue: "not_configured",
      message: "未配置 Supabase 环境变量",
      host: isVercel ? "vercel" : "server",
      proxy,
    });
  }

  const health = await pingSupabaseProject(url, anonKey, serverFetch);
  const authPost = await probeAuthTokenPost(url, anonKey, serverFetch);
  const ok = health.ok && authPost.ok;

  let issue: string | undefined;
  if (!health.ok && /ENOTFOUND|无法解析|NXDOMAIN|fetch failed/i.test(health.message + authPost.message)) {
    issue = "invalid_supabase_url";
  } else if (!ok) {
    issue = "connection_failed";
  }

  return NextResponse.json({
    ok,
    issue,
    message: ok ? "云端数据库连接正常" : health.ok ? authPost.message : health.message,
    supabaseHost: maskSupabaseUrl(url),
    health,
    authPost,
    host: isVercel ? "vercel" : "server",
    proxy,
  });
}

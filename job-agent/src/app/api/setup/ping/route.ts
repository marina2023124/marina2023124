import { NextResponse } from "next/server";
import { pingSupabaseProject } from "@/lib/supabase/ping";
import { getServerProxyStatus, serverFetch } from "@/lib/supabase/server-fetch";

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
  return NextResponse.json({ ...result, proxy });
}

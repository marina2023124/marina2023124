import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { url, anonKey } = await request.json();

    if (!url || !anonKey) {
      return NextResponse.json({ ok: false, error: "请填写 URL 和 anon key" }, { status: 400 });
    }

    if (!url.includes("supabase.co")) {
      return NextResponse.json({ ok: false, error: "URL 格式不正确，应以 supabase.co 结尾" }, { status: 400 });
    }

    const supabase = createClient(url, anonKey);
    const { error } = await supabase.from("user_app_data").select("user_id").limit(1);

    if (error) {
      if (error.code === "PGRST205" || error.message.includes("Could not find the table")) {
        return NextResponse.json({
          ok: false,
          error: "连接成功，但数据表未创建。请先在 SQL Editor 执行建表 SQL（步骤 2）",
        });
      }
      if (error.message.includes("permission denied")) {
        return NextResponse.json({
          ok: false,
          error:
            "数据表已创建，但缺少访问权限。请在 Supabase SQL Editor 执行 fix-permissions.sql 中的 SQL",
        });
      }
      if (error.message.includes("Invalid API key") || error.message.includes("JWT")) {
        return NextResponse.json({ ok: false, error: "anon key 无效，请重新复制" });
      }
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, message: "Supabase 连接正常，数据表已就绪" });
  } catch {
    return NextResponse.json({ ok: false, error: "测试失败，请检查网络或密钥" }, { status: 500 });
  }
}

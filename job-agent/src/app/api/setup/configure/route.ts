import { writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "生产环境请通过部署平台设置环境变量，不要使用此接口" },
      { status: 403 }
    );
  }

  try {
    const { url, anonKey } = await request.json();

    if (!url || !anonKey) {
      return NextResponse.json({ ok: false, error: "请填写 URL 和 anon key" }, { status: 400 });
    }

    const content = [
      "# Supabase 云端存储配置",
      `NEXT_PUBLIC_SUPABASE_URL=${url.trim()}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.trim()}`,
      "",
    ].join("\n");

    await writeFile(join(process.cwd(), ".env.local"), content, "utf-8");

    return NextResponse.json({
      ok: true,
      message: "配置已保存到 .env.local。请重启开发服务器（Ctrl+C 后重新运行 npm run dev），然后刷新页面。",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "无法写入 .env.local，请手动复制 .env.local.example 并填入密钥",
      },
      { status: 500 }
    );
  }
}

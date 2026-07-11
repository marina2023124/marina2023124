import { writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

function isHostedDeploy(): boolean {
  return process.env.VERCEL === "1" || process.env.NETLIFY === "true";
}

function canConfigureViaApi(): boolean {
  if (process.env.ALLOW_SETUP_CONFIGURE === "0") return false;
  if (process.env.ALLOW_SETUP_CONFIGURE === "1") return true;
  // Self-hosted production (e.g. ./start.sh) can write .env.local; PaaS cannot.
  return process.env.NODE_ENV !== "production" || !isHostedDeploy();
}

export async function POST(request: Request) {
  if (!canConfigureViaApi()) {
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

    const isProd = process.env.NODE_ENV === "production";
    const message = isProd
      ? "配置已保存到 .env.local。请重启服务（终端 Ctrl+C 后运行 ./start.sh），会自动重新构建，然后刷新页面。"
      : "配置已保存到 .env.local。请重启开发服务器（Ctrl+C 后重新运行 npm run dev），然后刷新页面。";

    return NextResponse.json({
      ok: true,
      message,
      needsRestart: true,
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

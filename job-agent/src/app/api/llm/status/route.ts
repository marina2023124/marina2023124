import { NextResponse } from "next/server";
import { isDeepSeekConfigured, isDeepSeekKeyFormatValid } from "@/lib/llm/config";

export async function GET() {
  const configured = isDeepSeekConfigured();
  const formatValid = isDeepSeekKeyFormatValid();

  return NextResponse.json({
    configured,
    provider: "deepseek",
    formatValid,
    hint: !configured
      ? "请在 Vercel / .env.local 设置 DEEPSEEK_API_KEY"
      : !formatValid
        ? "Key 格式不对：DeepSeek Key 应以 sk- 开头，请到 platform.deepseek.com 重新创建"
        : undefined,
  });
}

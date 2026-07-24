import { NextResponse } from "next/server";
import { isDeepSeekConfigured } from "@/lib/llm/config";

export async function GET() {
  return NextResponse.json({
    configured: isDeepSeekConfigured(),
    provider: "deepseek",
  });
}

import { NextResponse } from "next/server";
import { parseJobDescription } from "@/lib/jd-parser";

export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "缺少 JD 文本" }, { status: 400 });
    }

    const draft = parseJobDescription(text);
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

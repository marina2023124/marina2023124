import { NextResponse } from "next/server";
import { importJobFromUrl } from "@/lib/job-importers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "请提供岗位链接" }, { status: 400 });
    }

    const draft = await importJobFromUrl(url);
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

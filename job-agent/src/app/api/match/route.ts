import { NextResponse } from "next/server";
import { getOpenidFromAuthHeader } from "@/lib/wechat-auth";
import { matchAllJobs } from "@/lib/matching";
import type { AppData } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as Pick<AppData, "profile" | "jobs">;
    if (!body.profile || !body.jobs) {
      return NextResponse.json({ error: "缺少 profile 或 jobs" }, { status: 400 });
    }

    const matches = matchAllJobs(body.profile, body.jobs);
    return NextResponse.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "匹配失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

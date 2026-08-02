import { NextResponse } from "next/server";
import { getOpenidFromAuthHeader } from "@/lib/wechat-auth";
import { loadWechatData, saveWechatData } from "@/lib/wechat-storage";
import type { AppData } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ error: "未登录" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) return unauthorized();

    const data = await loadWechatData(openid);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) return unauthorized();

    const appData = (await request.json()) as AppData;
    await saveWechatData(openid, appData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

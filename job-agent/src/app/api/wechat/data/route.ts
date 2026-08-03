import { NextResponse } from "next/server";
import { getOpenidFromAuthHeader } from "@/lib/wechat-auth";
import { loadLinkedAppData, saveLinkedAppData } from "@/lib/wechat-link";
import type { AppData } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ error: "未登录" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) return unauthorized();

    const { data } = await loadLinkedAppData(openid);
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
    const { linked } = await saveLinkedAppData(openid, appData);
    return NextResponse.json({ ok: true, linked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getOpenidFromAuthHeader } from "@/lib/wechat-auth";
import { bindWechatAccount, getWechatLink, loadLinkedAppData } from "@/lib/wechat-link";

export async function GET(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const link = await getWechatLink(openid);
    return NextResponse.json({
      linked: Boolean(link),
      linkedAt: link?.linkedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const openid = getOpenidFromAuthHeader(request.headers.get("authorization"));
    if (!openid) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { bindCode, code } = (await request.json()) as {
      bindCode?: string;
      code?: string;
    };

    const normalizedCode = (bindCode || code || "").trim();
    if (!normalizedCode) {
      return NextResponse.json({ error: "请输入绑定码" }, { status: 400 });
    }

    const result = await bindWechatAccount(normalizedCode, openid);
    const { data } = await loadLinkedAppData(openid);

    return NextResponse.json({
      ok: true,
      linked: true,
      merged: result.merged,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "绑定失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

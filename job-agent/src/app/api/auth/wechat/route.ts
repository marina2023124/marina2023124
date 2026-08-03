import { NextResponse } from "next/server";
import { createDemoAppData } from "@/lib/demo-data";
import { exchangeWechatCode, signWechatToken } from "@/lib/wechat-auth";
import { loadLinkedAppData, saveLinkedAppData } from "@/lib/wechat-link";

export async function POST(request: Request) {
  try {
    const { code, useDemo } = (await request.json()) as {
      code?: string;
      useDemo?: boolean;
    };

    if (!code) {
      return NextResponse.json({ error: "缺少 code" }, { status: 400 });
    }

    const session = await exchangeWechatCode(code);
    const loaded = await loadLinkedAppData(session.openid);
    let data = loaded.data;

    const isNew =
      data.jobs.length === 0 &&
      data.profile.workExperiences.length === 0 &&
      !data.profile.name;

    if (isNew && useDemo) {
      data = createDemoAppData();
      await saveLinkedAppData(session.openid, data);
    }

    const token = signWechatToken(session.openid);
    return NextResponse.json({
      token,
      data,
      isNew,
      linked: loaded.linked,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "微信登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

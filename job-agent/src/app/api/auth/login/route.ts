import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { passwordSignIn, persistAuthSession } from "@/lib/supabase/password-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "请填写邮箱和密码" }, { status: 400 });
    }

    const session = await passwordSignIn(email, password);
    const supabase = await createServerSupabaseClient();
    await persistAuthSession(supabase, session);

    return NextResponse.json({
      ok: true,
      user: { id: session.user?.id, email: session.user?.email },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "登录失败";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

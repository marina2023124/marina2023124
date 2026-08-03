import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "请填写邮箱和密码" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "注册失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

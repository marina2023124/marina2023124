import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadCloudData, saveCloudData } from "@/lib/cloud-storage";
import type { AppData } from "@/lib/types";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase: null, user: null, error: "未登录" };
  }

  return { supabase, user, error: null };
}

export async function GET() {
  try {
    const { supabase, user, error } = await requireUser();
    if (!supabase || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const data = await loadCloudData(supabase, user.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user, error } = await requireUser();
    if (!supabase || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const appData = (await request.json()) as AppData;
    await saveCloudData(supabase, user.id, appData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

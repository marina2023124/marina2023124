import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MIDDLEWARE_AUTH_TIMEOUT_MS = 2000;

function isConfigured(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (url.includes("your-project") || key.includes("your-anon")) return false;
  return url.includes("supabase.co");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isConfigured(url, key)) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    await Promise.race([
      supabase.auth.getUser(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("middleware auth timeout")), MIDDLEWARE_AUTH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // 云端不可达时不阻塞页面加载
  }

  return supabaseResponse;
}

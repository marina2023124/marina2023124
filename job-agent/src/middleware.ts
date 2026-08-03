import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 访客体验页、离线/访客 cookie：不连 Supabase，国内无需 VPN
  if (
    pathname === "/try" ||
    pathname.startsWith("/api/auth/wechat") ||
    pathname.startsWith("/api/wechat/") ||
    pathname === "/api/match" ||
    pathname === "/api/jobs/parse-text" ||
    pathname === "/api/jobs/ocr-image" ||
    pathname === "/api/jobs/import-url" ||
    request.cookies.get("job-agent-offline")?.value === "1" ||
    request.cookies.get("job-agent-guest-mode")?.value === "1"
  ) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

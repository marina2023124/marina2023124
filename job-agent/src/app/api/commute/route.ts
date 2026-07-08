import { NextResponse } from "next/server";
import { estimateCommute } from "@/lib/commute";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json({ error: "缺少 address 参数" }, { status: 400 });
  }

  const result = estimateCommute(address);
  if (!result) {
    return NextResponse.json({ error: "无法估算通勤" }, { status: 400 });
  }

  return NextResponse.json(result);
}

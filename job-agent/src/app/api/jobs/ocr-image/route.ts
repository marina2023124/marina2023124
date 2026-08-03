import { NextResponse } from "next/server";
import { parseJobDescription } from "@/lib/jd-parser";
import { extractTextFromImage } from "@/lib/ocr";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "请上传截图" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "仅支持图片格式" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const upload = new File([buffer], "screenshot.png", {
      type: file.type || "image/png",
    });

    const text = await extractTextFromImage(upload);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "未能从截图识别到文字，请在 BOSS 详情页复制 JD 文字粘贴" },
        { status: 422 }
      );
    }

    const draft = parseJobDescription(text);
    return NextResponse.json({ text, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "截图识别失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

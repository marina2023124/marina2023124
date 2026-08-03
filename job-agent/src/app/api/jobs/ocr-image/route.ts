import { NextResponse } from "next/server";
import { parseJobDescription } from "@/lib/jd-parser";
import { extractJobFromImageWithVision } from "@/lib/llm/vision-jd";
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
    const mimeType = file.type || "image/png";

    const vision = await extractJobFromImageWithVision(buffer, mimeType);
    if (vision) {
      return NextResponse.json({
        text: vision.text,
        draft: vision.draft,
        method: vision.source,
      });
    }

    const upload = new File([buffer], "screenshot.png", { type: mimeType });
    const text = await extractTextFromImage(upload);
    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "未能识别截图内容。请对微信里的 BOSS 卡片或详情页截图后重试，或使用「快速录入」手动填写",
        },
        { status: 422 }
      );
    }

    const draft = parseJobDescription(text);
    return NextResponse.json({ text, draft, method: "ocr" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "截图识别失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

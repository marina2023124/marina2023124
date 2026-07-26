import { NextResponse } from "next/server";
import {
  getVercelDeployEnv,
  isDeepSeekConfigured,
  isDeepSeekKeyFormatValid,
} from "@/lib/llm/config";
import { verifyDeepSeekKey } from "@/lib/llm/deepseek";

function buildHint(opts: {
  configured: boolean;
  formatValid: boolean;
  liveValid?: boolean;
  reason?: string;
  vercelEnv?: string;
}): string | undefined {
  const { configured, formatValid, liveValid, reason, vercelEnv } = opts;

  if (!configured) {
    return "请在 Vercel / .env.local 设置 DEEPSEEK_API_KEY";
  }
  if (!formatValid) {
    return "Key 格式不对：DeepSeek Key 应以 sk- 开头，请到 platform.deepseek.com 重新创建";
  }
  if (liveValid === false) {
    if (reason === "insufficient_balance") {
      return "DeepSeek 账户余额不足，请到 platform.deepseek.com 充值";
    }
    if (reason === "invalid_key") {
      const previewHint =
        vercelEnv === "preview"
          ? "当前是 Preview 部署，请确认 Vercel 环境变量勾选了 Preview 并 Redeploy。"
          : "";
      return `DeepSeek 拒绝了当前 Key（401）。请到 platform.deepseek.com 新建 Key，完整粘贴到 Vercel 的 DEEPSEEK_API_KEY，勾选 Production + Preview 后 Redeploy。${previewHint}`;
    }
    if (reason === "network_error") {
      return "无法连接 DeepSeek 服务器，请稍后重试";
    }
    return "DeepSeek 连通性检测失败，请检查 Key 与账户余额";
  }
  return undefined;
}

export async function GET(request: Request) {
  const configured = isDeepSeekConfigured();
  const formatValid = isDeepSeekKeyFormatValid();
  const vercelEnv = getVercelDeployEnv();

  const url = new URL(request.url);
  const shouldVerify = url.searchParams.get("verify") !== "0";

  let liveValid: boolean | undefined;
  let verifyReason: string | undefined;
  let httpStatus: number | undefined;

  if (configured && formatValid && shouldVerify) {
    const verify = await verifyDeepSeekKey();
    liveValid = verify.liveValid;
    verifyReason = verify.reason;
    httpStatus = verify.httpStatus;
  }

  const hint = buildHint({
    configured,
    formatValid,
    liveValid,
    reason: verifyReason,
    vercelEnv,
  });

  return NextResponse.json({
    configured,
    provider: "deepseek",
    formatValid,
    liveValid,
    verifyReason,
    httpStatus,
    vercelEnv,
    hint,
  });
}

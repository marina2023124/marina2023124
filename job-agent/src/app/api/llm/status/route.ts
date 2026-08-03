import { NextResponse } from "next/server";
import {
  getDeepSeekConfig,
  getVercelDeployEnv,
  isDeepSeekConfigured,
  isDeepSeekKeyFormatValid,
} from "@/lib/llm/config";
import { verifyDeepSeekKey } from "@/lib/llm/deepseek";
import { getServerProxyStatus } from "@/lib/supabase/server-fetch";

function buildHint(opts: {
  configured: boolean;
  formatValid: boolean;
  liveValid?: boolean;
  reason?: string;
  vercelEnv?: string;
  deepseekMessage?: string;
}): string | undefined {
  const { configured, formatValid, liveValid, reason, vercelEnv, deepseekMessage } = opts;

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
          ? " 当前是 Preview 部署，请确认环境变量勾选了 Preview 并 Redeploy。"
          : "";
      return `${deepseekMessage ?? "DeepSeek 认证失败"}。请在本机用 curl 测试同一 Key：若 curl 也失败，说明 Key/账户有问题；若 curl 成功，请检查 Vercel 是否粘贴完整并 Redeploy。${previewHint}`;
    }
    if (reason === "network_error") {
      return "无法连接 DeepSeek 服务器，请稍后重试";
    }
    if (reason === "request_failed") {
      return deepseekMessage ?? "DeepSeek 请求失败，请检查 DEEPSEEK_BASE_URL / DEEPSEEK_MODEL 配置";
    }
    return "DeepSeek 连通性检测失败，请检查 Key 与账户余额";
  }
  return undefined;
}

export async function GET(request: Request) {
  const configured = isDeepSeekConfigured();
  const formatValid = isDeepSeekKeyFormatValid();
  const vercelEnv = getVercelDeployEnv();
  const apiKey = configured ? getDeepSeekConfig().apiKey : "";

  const url = new URL(request.url);
  const shouldVerify = url.searchParams.get("verify") !== "0";

  let liveValid: boolean | undefined;
  let verifyReason: string | undefined;
  let httpStatus: number | undefined;
  let deepseekMessage: string | undefined;

  if (configured && formatValid && shouldVerify) {
    const verify = await verifyDeepSeekKey();
    liveValid = verify.liveValid;
    verifyReason = verify.reason;
    httpStatus = verify.httpStatus;
    deepseekMessage = verify.deepseekMessage;
  }

  const hint = buildHint({
    configured,
    formatValid,
    liveValid,
    reason: verifyReason,
    vercelEnv,
    deepseekMessage,
  });

  return NextResponse.json({
    configured,
    provider: "deepseek",
    formatValid,
    liveValid,
    verifyReason,
    httpStatus,
    deepseekMessage,
    vercelEnv,
    keyLength: apiKey ? apiKey.length : 0,
    keyPrefix: apiKey ? apiKey.slice(0, 7) : undefined,
    baseUrl: configured ? getDeepSeekConfig().baseUrl : undefined,
    model: configured ? getDeepSeekConfig().model : undefined,
    proxyConfigured: getServerProxyStatus().configured,
    hint,
  });
}

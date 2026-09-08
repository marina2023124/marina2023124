import fs from "fs";
import path from "path";

let loaded = false;

/** 从 .env.local 注入 HTTPS_PROXY（本机 Clash 场景，避免只改文件未重启进程） */
export function ensureProxyEnv(): void {
  if (loaded) return;
  loaded = true;

  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY) {
    return;
  }

  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    return;
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;

    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^(HTTPS_PROXY|HTTP_PROXY)=(.+)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!value) continue;
      process.env.HTTP_PROXY = value;
      process.env.HTTPS_PROXY = value;
      break;
    }
  } catch {
    // ignore
  }
}

export function getProxyUrl(): string | undefined {
  ensureProxyEnv();
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
}

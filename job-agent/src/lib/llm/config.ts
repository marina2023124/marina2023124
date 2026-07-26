/** Strip whitespace and accidental wrapping quotes from Vercel / .env values. */
export function normalizeDeepSeekApiKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, "");
}

export function isDeepSeekConfigured(): boolean {
  const key = normalizeDeepSeekApiKey(process.env.DEEPSEEK_API_KEY);
  return Boolean(key && key.length > 8 && !key.includes("your-"));
}

export function isDeepSeekKeyFormatValid(): boolean {
  const key = normalizeDeepSeekApiKey(process.env.DEEPSEEK_API_KEY);
  // DeepSeek official keys: sk-xxxxxxxx (hyphen). Reject sk_live_ (Stripe etc.).
  return /^sk-[a-zA-Z0-9]/.test(key);
}

export function getDeepSeekConfig() {
  const apiKey = normalizeDeepSeekApiKey(process.env.DEEPSEEK_API_KEY);
  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  };
}

export function getVercelDeployEnv(): string | undefined {
  return process.env.VERCEL_ENV;
}

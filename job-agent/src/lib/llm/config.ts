export function isDeepSeekConfigured(): boolean {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  return Boolean(key && key.length > 8 && !key.includes("your-"));
}

export function isDeepSeekKeyFormatValid(): boolean {
  const key = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  return key.startsWith("sk-");
}

export function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  };
}

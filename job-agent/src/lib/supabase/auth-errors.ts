export function formatAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : "操作失败";
  if (/fetch failed|Failed to fetch|NetworkError|timeout|超时/i.test(message)) {
    return "无法连接项目 API（*.supabase.co），请确认 VPN 为全局模式后点「测试云端连接」";
  }
  if (/Invalid login credentials/i.test(message)) {
    return "邮箱或密码错误，请检查后重试";
  }
  if (/Email not confirmed/i.test(message)) {
    return "邮箱尚未验证，请先到邮箱点击验证链接";
  }
  return message;
}

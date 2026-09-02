export function formatAuthError(err: unknown, opts?: { serverReachable?: boolean }): string {
  const message = err instanceof Error ? err.message : "操作失败";
  if (/Invalid login credentials/i.test(message)) {
    return "邮箱或密码错误，请检查后重试";
  }
  if (/Email not confirmed/i.test(message)) {
    return "邮箱尚未验证，请先到邮箱点击验证链接";
  }
  if (/fetch failed|Failed to fetch|NetworkError/i.test(message)) {
    if (opts?.serverReachable) {
      return "登录请求失败，请重试；若仍失败，请改用线上版登录（见下方链接）";
    }
    return "无法连接项目 API（*.supabase.co），请确认 VPN 为全局模式后点「测试云端连接」";
  }
  if (/timeout|超时/i.test(message)) {
    if (opts?.serverReachable) {
      return "登录超时，Supabase 响应较慢。请重试，或直接使用线上版：https://marina2023124.vercel.app/login";
    }
    return "请求超时：本机服务无法连接 Supabase，请换 VPN 节点或改用线上版";
  }
  return message;
}

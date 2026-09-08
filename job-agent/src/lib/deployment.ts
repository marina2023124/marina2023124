/** 是否为线上部署（非 localhost 本机开发） */
export function isOnlineDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}

export const ONLINE_LOGIN_URL = "https://marina2023124.vercel.app/login";
export const ONLINE_TRY_URL = "https://marina2023124.vercel.app/try";
export const VERCEL_ENV_SETTINGS =
  "https://vercel.com/marina2023124s-projects/marina2023124/settings/environment-variables";

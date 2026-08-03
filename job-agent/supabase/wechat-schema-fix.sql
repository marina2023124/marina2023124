-- 修复「permission denied for table wechat_user_data」
-- 在 Supabase SQL Editor 执行（已跑过 wechat-schema.sql 的用户也需要执行本文件）

grant all on public.wechat_user_data to service_role;
revoke all on public.wechat_user_data from anon, authenticated;

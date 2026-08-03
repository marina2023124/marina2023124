-- 修复小程序/绑定相关表的 permission denied
-- 在 Supabase SQL Editor 执行（已跑过 wechat-schema / wechat-link-schema 的用户也需要执行本文件）

grant all on public.wechat_user_data to service_role;
revoke all on public.wechat_user_data from anon, authenticated;

grant select on public.user_wechat_links to authenticated;
grant all on public.user_wechat_links to service_role;
grant all on public.wechat_bind_codes to service_role;
revoke all on public.wechat_bind_codes from anon, authenticated;

drop policy if exists "Users can read own wechat link" on public.user_wechat_links;
create policy "Users can read own wechat link"
  on public.user_wechat_links for select
  using (auth.uid() = user_id);

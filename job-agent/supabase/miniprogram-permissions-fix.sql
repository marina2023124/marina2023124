-- 小程序登录 + 网页绑定 所需全部权限（在 Supabase SQL Editor 一次性执行）
-- 适用于 permission denied for wechat_user_data / user_app_data / user_wechat_links

-- 网页用户数据（绑定时 Service Role 需读写）
grant all on public.user_app_data to service_role;

-- 小程序独立数据
grant all on public.wechat_user_data to service_role;
revoke all on public.wechat_user_data from anon, authenticated;

-- 账号绑定
grant select on public.user_wechat_links to authenticated;
grant all on public.user_wechat_links to service_role;
grant all on public.wechat_bind_codes to service_role;
revoke all on public.wechat_bind_codes from anon, authenticated;

drop policy if exists "Users can read own wechat link" on public.user_wechat_links;
create policy "Users can read own wechat link"
  on public.user_wechat_links for select
  using (auth.uid() = user_id);

-- 修复 permission denied 错误（在 SQL Editor 执行此段即可）
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_app_data to authenticated;
grant select on public.user_app_data to anon;
grant all on public.user_app_data to service_role;

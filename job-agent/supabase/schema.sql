-- JobAgent 云端存储表结构
-- 在 Supabase Dashboard → SQL Editor 中执行

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

-- 授予角色访问权限（缺少这步会报 permission denied）
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_app_data to authenticated;
grant select on public.user_app_data to anon;
grant all on public.user_app_data to service_role;

-- 删除旧策略（重复执行时避免冲突）
drop policy if exists "Users can read own data" on public.user_app_data;
drop policy if exists "Users can insert own data" on public.user_app_data;
drop policy if exists "Users can update own data" on public.user_app_data;
drop policy if exists "Users can delete own data" on public.user_app_data;

create policy "Users can read own data"
  on public.user_app_data for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_app_data for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_app_data for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_app_data for delete
  to authenticated
  using (auth.uid() = user_id);

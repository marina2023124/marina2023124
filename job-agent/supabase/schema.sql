-- JobAgent 云端存储表结构
-- 在 Supabase Dashboard → SQL Editor 中执行

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

create policy "Users can read own data"
  on public.user_app_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_app_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_app_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_app_data for delete
  using (auth.uid() = user_id);

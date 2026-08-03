-- 微信小程序用户数据（Service Role 读写，不经 RLS）
create table if not exists public.wechat_user_data (
  openid text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wechat_user_data enable row level security;

-- 禁止 anon/authenticated 直接访问，仅服务端 Service Role 使用
grant all on public.wechat_user_data to service_role;
revoke all on public.wechat_user_data from anon, authenticated;

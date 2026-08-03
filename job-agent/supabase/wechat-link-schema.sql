-- 网页 Supabase 账号 ↔ 微信小程序 openid 绑定
create table if not exists public.user_wechat_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openid text not null unique,
  linked_at timestamptz not null default now()
);

create index if not exists idx_user_wechat_links_openid on public.user_wechat_links(openid);

alter table public.user_wechat_links enable row level security;

drop policy if exists "Users can read own wechat link" on public.user_wechat_links;
create policy "Users can read own wechat link"
  on public.user_wechat_links for select
  using (auth.uid() = user_id);

-- 绑定码（网页生成，小程序输入，一次性）
create table if not exists public.wechat_bind_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_wechat_bind_codes_user on public.wechat_bind_codes(user_id);

alter table public.wechat_bind_codes enable row level security;

-- 网页登录用户可读自己的绑定状态；写入仅 Service Role（API 路由）
grant select on public.user_wechat_links to authenticated;
grant all on public.user_wechat_links to service_role;
grant all on public.wechat_bind_codes to service_role;
revoke all on public.wechat_bind_codes from anon, authenticated;

-- 网页 Supabase 账号 ↔ 微信小程序 openid 绑定
create table if not exists public.user_wechat_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openid text not null unique,
  linked_at timestamptz not null default now()
);

create index if not exists idx_user_wechat_links_openid on public.user_wechat_links(openid);

alter table public.user_wechat_links enable row level security;

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

-- 仅服务端 Service Role 读写绑定码与写入链接
revoke all on public.user_wechat_links from anon, authenticated;
revoke all on public.wechat_bind_codes from anon, authenticated;

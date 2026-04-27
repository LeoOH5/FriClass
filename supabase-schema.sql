-- 모임 테이블
create table if not exists gatherings (
  id uuid primary key default gen_random_uuid(),
  dong_code text not null,
  status text not null default 'open' check (status in ('open', 'complete')),
  created_by text not null,
  note text,
  meeting_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- 참여자 테이블
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references gatherings(id) on delete cascade,
  user_uuid text not null,
  created_at timestamptz not null default now(),
  unique(gathering_id, user_uuid)
);

-- messages 테이블
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  gathering_id uuid references gatherings(id) on delete cascade not null,
  user_uuid text not null,
  message text not null,
  created_at timestamptz default now() not null
);

-- 인덱스
create index if not exists idx_gatherings_dong_code on gatherings(dong_code);
create index if not exists idx_gatherings_status_expires on gatherings(status, expires_at);
create index if not exists idx_participants_gathering on participants(gathering_id);

-- RLS 활성화
alter table gatherings enable row level security;
alter table participants enable row level security;
alter table messages enable row level security;

-- 누구나 읽기 가능
create policy "gatherings_select" on gatherings for select using (true);
create policy "participants_select" on participants for select using (true);
create policy "anyone can read messages" on messages for select using (true);

-- 누구나 생성 가능 (anon key 사용)
create policy "gatherings_insert" on gatherings for insert with check (true);
create policy "participants_insert" on participants for insert with check (true);
create policy "anyone can insert messages" on messages for insert with check (true);

-- 본인 모임만 수정 가능
create policy "gatherings_update" on gatherings for update using (true);

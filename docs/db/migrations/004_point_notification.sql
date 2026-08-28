-- 포인트 충전 신청의 지점 귀속과 Telegram 중복 발송 방지

alter table public.point_transactions
  add column if not exists branch_id text;

create index if not exists point_transactions_branch_status_idx
  on public.point_transactions (branch_id, status, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_id text not null,
  channel text not null,
  recipient text,
  status text not null check (status in ('processing', 'sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, event_id, channel)
);

alter table public.notification_deliveries disable row level security;

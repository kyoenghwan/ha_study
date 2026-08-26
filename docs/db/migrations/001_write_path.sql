-- =====================================================================
-- HA-STUDY 마이그레이션 001 — 기본 스키마 + DB 쓰기 경로 정상화
-- 대응 스키마 버전: docs/db/schema.md 1.2.0
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
--
-- 안전성:
--   모든 문장이 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 이므로
--   테이블이 이미 있든 없든, 몇 번을 실행하든 무해하다.
--   Supabase SQL Editor 는 스크립트를 한 트랜잭션으로 실행하므로
--   중간에 실패하면 아무것도 적용되지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 현재 상태 확인용 (필요하면 이 쿼리만 따로 실행)
-- ---------------------------------------------------------------------
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;

-- ---------------------------------------------------------------------
-- 1. users — 회원
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  password   text,
  name       text not null default '',
  phone      text,
  role       text not null default 'user',
  points     integer not null default 0,
  created_at timestamptz not null default now()
);

-- 이미 존재하는 테이블에 컬럼이 빠져 있을 수 있으므로 개별 보정한다.
alter table public.users add column if not exists user_id    text;
alter table public.users add column if not exists password   text;
alter table public.users add column if not exists name       text;
alter table public.users add column if not exists phone      text;
alter table public.users add column if not exists role       text default 'user';
alter table public.users add column if not exists points     integer default 0;
alter table public.users add column if not exists created_at timestamptz default now();

-- 클라이언트가 crypto.randomUUID() 로 id 를 발급하지만,
-- DB 직접 삽입 시에도 값이 채워지도록 기본값을 둔다.
-- id 컬럼이 uuid 타입일 때만 적용한다 (text 타입이면 타입 불일치로 실패한다).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'id' and data_type = 'uuid'
  ) then
    execute 'alter table public.users alter column id set default gen_random_uuid()';
  end if;
end $$;

-- user_id 는 회원 갱신(update ... where user_id = ?)의 기준이므로 UNIQUE 필수.
-- 실패하면 중복 user_id 가 있다는 뜻이다. 아래 쿼리로 확인 후 정리할 것:
--   select user_id, count(*) from public.users group by user_id having count(*) > 1;
create unique index if not exists users_user_id_uniq
  on public.users (user_id);

-- ---------------------------------------------------------------------
-- 2. rooms — 공간
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id          text primary key,
  name        text not null,
  capacity    integer not null default 1,
  description text
);

alter table public.rooms add column if not exists name        text;
alter table public.rooms add column if not exists capacity    integer default 1;
alter table public.rooms add column if not exists description text;

-- ---------------------------------------------------------------------
-- 3. reservations — 예약
-- ---------------------------------------------------------------------
create table if not exists public.reservations (
  id             text primary key,
  room_id        text,
  date           text,
  start_time     text,
  end_time       text,
  user_name      text,
  user_phone     text,
  cost_points    integer default 0,
  cost_amount    integer default 0,
  payment_method text default 'points',
  payment_status text default 'paid',
  barcode_id     text,
  barcode_status text default 'valid',
  is_long_term   boolean default false,
  created_at     timestamptz not null default now()
);

alter table public.reservations add column if not exists room_id        text;
alter table public.reservations add column if not exists date           text;
alter table public.reservations add column if not exists start_time     text;
alter table public.reservations add column if not exists end_time       text;
alter table public.reservations add column if not exists user_name      text;
alter table public.reservations add column if not exists user_phone     text;
alter table public.reservations add column if not exists cost_points    integer default 0;
alter table public.reservations add column if not exists cost_amount    integer default 0;
alter table public.reservations add column if not exists payment_method text default 'points';
alter table public.reservations add column if not exists payment_status text default 'paid';
alter table public.reservations add column if not exists barcode_id     text;
alter table public.reservations add column if not exists barcode_status text default 'valid';
alter table public.reservations add column if not exists is_long_term   boolean default false;
alter table public.reservations add column if not exists created_at     timestamptz default now();

-- ---------------------------------------------------------------------
-- 4. master_barcodes — 대표 출입 바코드
-- ---------------------------------------------------------------------
create table if not exists public.master_barcodes (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'number',
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.master_barcodes add column if not exists type       text default 'number';
alter table public.master_barcodes add column if not exists value      text;
alter table public.master_barcodes add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- 5. point_transactions — 포인트 입출금·환불 이력
--    user_id 는 users.id(UUID) 가 아니라 로그인 아이디(users.user_id, TEXT) 다.
--    앱 코드(src/lib/supabase.ts)가 tx.userId 를 그대로 넣는다.
-- ---------------------------------------------------------------------
create table if not exists public.point_transactions (
  id          text primary key,
  user_id     text,
  user_name   text,
  type        text not null default 'use',
  amount      integer not null default 0,
  description text,
  status      text not null default 'completed',
  created_at  timestamptz not null default now()
);

alter table public.point_transactions add column if not exists user_id     text;
alter table public.point_transactions add column if not exists user_name   text;
alter table public.point_transactions add column if not exists type        text default 'use';
alter table public.point_transactions add column if not exists amount      integer default 0;
alter table public.point_transactions add column if not exists description text;
alter table public.point_transactions add column if not exists status      text default 'completed';
alter table public.point_transactions add column if not exists created_at  timestamptz default now();

-- ---------------------------------------------------------------------
-- 6. admin_barcodes — 관리자 사전 등록 바코드 (기존 localStorage)
-- ---------------------------------------------------------------------
create table if not exists public.admin_barcodes (
  id                      text primary key,
  barcode_id              text not null unique,
  status                  text not null default 'available'
                            check (status in ('available','assigned','used')),
  assigned_to_user_name   text,
  assigned_reservation_id text,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. app_settings — 입금 계좌 등 단일값 운영 설정 (기존 localStorage)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. 조회 성능 인덱스
-- ---------------------------------------------------------------------
create index if not exists reservations_room_date_idx
  on public.reservations (room_id, date);

create index if not exists reservations_date_idx
  on public.reservations (date);

create index if not exists point_transactions_user_idx
  on public.point_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9. 초기 데이터 (해당 테이블이 비어 있을 때만)
--    운영 지점의 실제 값으로 교체해서 사용할 것.
-- ---------------------------------------------------------------------

-- 9-1. 공간
insert into public.rooms (id, name, capacity, description)
select * from (values
  ('room-1', '스터디 존 A (4인실)',  4, '집중이 잘되는 조명과 화이트보드가 준비된 4인실 공부방입니다.'),
  ('room-2', '스터디 존 B (6인실)',  6, '개별 모니터와 콘센트가 구비된 그룹 스터디용 6인실입니다.'),
  ('room-3', '세미나룸 C (10인실)', 10, '대형 빔프로젝터와 음향 장비가 완비된 단체 세미나용 10인실입니다.')
) as v(id, name, capacity, description)
where not exists (select 1 from public.rooms);

-- 9-2. 대표 출입 바코드
insert into public.master_barcodes (type, value)
select 'number', '*M091063684*'
where not exists (select 1 from public.master_barcodes);

-- 9-3. 입금 계좌 정보
insert into public.app_settings (key, value)
select 'bank_info', jsonb_build_object(
  'bankName', '신한은행',
  'accountNumber', '110-384-918234',
  'accountHolder', '(주)르하임 여의도점'
)
on conflict (key) do nothing;

-- =====================================================================
-- 실행 후 확인
-- =====================================================================
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;
--
-- 기대 결과: admin_barcodes, app_settings, master_barcodes,
--            point_transactions, reservations, rooms, users
--
-- ⚠️ RLS 는 아직 적용되지 않았다. 다음 단계(Supabase Auth 전환)에서 처리한다.
--    현재는 anon 키로 모든 테이블을 읽고 쓸 수 있다.
-- =====================================================================

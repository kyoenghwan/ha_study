-- =====================================================================
-- HA-STUDY 마이그레이션 001 — DB 쓰기 경로 정상화
-- 대응 스키마 버전: docs/db/schema.md 1.2.0
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- 안전성: 모든 문장이 IF NOT EXISTS 이므로 여러 번 실행해도 무해하다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. rooms — 스키마에는 있었으나 앱이 사용하지 않던 테이블
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id          text primary key,
  name        text not null,
  capacity    integer not null default 1,
  description text
);

-- ---------------------------------------------------------------------
-- 2. admin_barcodes — 관리자 사전 등록 바코드 (기존 localStorage)
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
-- 3. app_settings — 입금 계좌 등 단일값 운영 설정 (기존 localStorage)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. users.id 기본값 보정
--    클라이언트가 crypto.randomUUID() 로 id를 발급하지만,
--    DB 직접 삽입 시에도 값이 채워지도록 기본값을 둔다.
-- ---------------------------------------------------------------------
alter table public.users
  alter column id set default gen_random_uuid();

-- user_id 는 회원 갱신(update ... where user_id = ?)의 기준이므로 UNIQUE 필수
create unique index if not exists users_user_id_uniq
  on public.users (user_id);

-- ---------------------------------------------------------------------
-- 5. 조회 성능 인덱스
-- ---------------------------------------------------------------------
create index if not exists reservations_room_date_idx
  on public.reservations (room_id, date);

create index if not exists reservations_date_idx
  on public.reservations (date);

create index if not exists point_transactions_user_idx
  on public.point_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. 초기 데이터 (rooms 가 비어 있을 때만)
--    운영 지점의 실제 공간으로 교체해서 사용할 것.
-- ---------------------------------------------------------------------
insert into public.rooms (id, name, capacity, description)
select * from (values
  ('room-1', '스터디 존 A (4인실)',  4, '집중이 잘되는 조명과 화이트보드가 준비된 4인실 공부방입니다.'),
  ('room-2', '스터디 존 B (6인실)',  6, '개별 모니터와 콘센트가 구비된 그룹 스터디용 6인실입니다.'),
  ('room-3', '세미나룸 C (10인실)', 10, '대형 빔프로젝터와 음향 장비가 완비된 단체 세미나용 10인실입니다.')
) as v(id, name, capacity, description)
where not exists (select 1 from public.rooms);

-- =====================================================================
-- 확인용 쿼리
-- =====================================================================
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;
--
-- ⚠️ RLS는 아직 적용되지 않았다. 다음 단계(Supabase Auth 전환)에서 처리한다.
--    현재는 anon 키로 모든 테이블을 읽고 쓸 수 있다.
-- =====================================================================

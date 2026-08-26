-- =====================================================================
-- HA-STUDY 마이그레이션 003 — RLS (Row Level Security) 정책 해제 및 허용
--
-- 문제: users 및 관련 테이블에 RLS가 켜져 있어 'new row violates row-level security policy' 에러 발생
-- 해결: 익명(anon) 클라이언트가 정상적으로 회원가입, 로그인, 예약, 조회를 수행할 수 있도록 RLS를 비활성화하거나 정책을 부여합니다.
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 [RUN] 실행
-- =====================================================================

-- 1. 모든 테이블 RLS 비활성화 (개발 및 현재 프로토타입 단계 전면 허용)
alter table if exists public.users disable row level security;
alter table if exists public.rooms disable row level security;
alter table if exists public.reservations disable row level security;
alter table if exists public.master_barcodes disable row level security;
alter table if exists public.point_transactions disable row level security;
alter table if exists public.admin_barcodes disable row level security;
alter table if exists public.app_settings disable row level security;
alter table if exists public.role_definitions disable row level security;
alter table if exists public.user_roles disable row level security;

-- 2. 만약 RLS를 활성화 상태로 유지해야 하는 경우를 위한 모든 작업(ALL) 허용 정책 등록 (안전 장치)
-- (DISABLE 상태에서는 정책이 무시되므로 안전하며, 추후 ENABLE로 변경 시 즉시 작동합니다)

do $$
begin
  -- users 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users') then
    drop policy if exists "Allow public access to users" on public.users;
    create policy "Allow public access to users" on public.users for all using (true) with check (true);
  end if;

  -- reservations 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reservations') then
    drop policy if exists "Allow public access to reservations" on public.reservations;
    create policy "Allow public access to reservations" on public.reservations for all using (true) with check (true);
  end if;

  -- rooms 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rooms') then
    drop policy if exists "Allow public access to rooms" on public.rooms;
    create policy "Allow public access to rooms" on public.rooms for all using (true) with check (true);
  end if;

  -- point_transactions 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'point_transactions') then
    drop policy if exists "Allow public access to point_transactions" on public.point_transactions;
    create policy "Allow public access to point_transactions" on public.point_transactions for all using (true) with check (true);
  end if;

  -- master_barcodes 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'master_barcodes') then
    drop policy if exists "Allow public access to master_barcodes" on public.master_barcodes;
    create policy "Allow public access to master_barcodes" on public.master_barcodes for all using (true) with check (true);
  end if;

  -- admin_barcodes 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'admin_barcodes') then
    drop policy if exists "Allow public access to admin_barcodes" on public.admin_barcodes;
    create policy "Allow public access to admin_barcodes" on public.admin_barcodes for all using (true) with check (true);
  end if;

  -- app_settings 테이블 정책
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_settings') then
    drop policy if exists "Allow public access to app_settings" on public.app_settings;
    create policy "Allow public access to app_settings" on public.app_settings for all using (true) with check (true);
  end if;
end $$;

-- =====================================================================
-- 3. 확인 쿼리 (아래 쿼리로 RLS 비활성화 여부를 확인하실 수 있습니다)
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- =====================================================================

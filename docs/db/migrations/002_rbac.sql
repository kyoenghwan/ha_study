-- =====================================================================
-- HA-STUDY 마이그레이션 002 — 권한 테이블 (RBAC)
-- 대응 스키마 버전: docs/db/schema.md 1.3.0
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- 선행 조건: 001_write_path.sql 을 먼저 실행해야 한다.
-- 안전성: 여러 번 실행해도 무해하다 (IF NOT EXISTS / ON CONFLICT).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 선행 조건 검사
--    user_roles.user_id 가 users.id 를 FK 로 참조하므로 타입이 맞아야 한다.
--    조건이 안 맞으면 알아보기 어려운 에러 대신 명확한 메시지로 중단한다.
-- ---------------------------------------------------------------------
do $$
declare id_type text;
begin
  select data_type into id_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'users' and column_name = 'id';

  if id_type is null then
    raise exception 'public.users 테이블이 없습니다. 001_write_path.sql 을 먼저 실행하세요.';
  end if;

  if id_type <> 'uuid' then
    -- RAISE 의 포맷 문자열은 리터럴만 허용한다 (|| 연결 불가).
    -- 자리표시자는 % 하나다. %% 는 리터럴 퍼센트 기호이므로 인자와 개수가 어긋난다.
    raise exception 'public.users.id 가 uuid 가 아니라 % 입니다. user_roles.user_id FK 를 만들 수 없습니다. docs/db/schema.md 1.3.0 기준으로 users.id 를 uuid 로 정렬한 뒤 다시 실행하세요.', id_type;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. role_definitions — 권한 정의
--    권한을 코드에 하드코딩하지 않고 데이터로 관리한다.
--    rank 가 클수록 상위 권한이며, 권한 부여 가능 여부 판정에 쓰인다.
-- ---------------------------------------------------------------------
create table if not exists public.role_definitions (
  code        text primary key,
  name        text not null,
  scope_level text not null check (scope_level in ('platform','brand','branch')),
  rank        integer not null
);

insert into public.role_definitions (code, name, scope_level, rank) values
  ('PLATFORM_ADMIN', '플랫폼 관리자', 'platform', 100),
  ('BRAND_ADMIN',    '브랜드 관리자', 'brand',     80),
  ('BRANCH_OWNER',   '지점 오너',     'branch',    60),
  ('BRANCH_ADMIN',   '지점 관리자',   'branch',    50),
  ('STAFF',          '지점 직원',     'branch',    30),
  ('CUSTOMER',       '일반 고객',     'platform',  10)
on conflict (code) do update
  set name = excluded.name,
      scope_level = excluded.scope_level,
      rank = excluded.rank;

-- ---------------------------------------------------------------------
-- 2. user_roles — 아이디별 권한 부여
--    회수는 삭제가 아니라 revoked_at 설정이다 (이력 보존).
--    scope_id 는 향후 branches.id 등을 가리킨다. 현재는 FK 없이 컬럼만 둔다.
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  role_code  text not null references public.role_definitions(code),
  scope_type text not null check (scope_type in ('platform','brand','branch')),
  scope_id   uuid,
  granted_by uuid references public.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  memo       text,
  constraint user_roles_scope_shape check (
    (scope_type = 'platform' and scope_id is null)
    or (scope_type <> 'platform' and scope_id is not null)
  )
);

-- 동일 범위의 활성 권한 중복 방지.
-- scope_id 가 NULL 이면 UNIQUE 가 중복을 못 막으므로 coalesce 로 치환한다.
create unique index if not exists user_roles_active_uniq
  on public.user_roles (
    user_id,
    role_code,
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

create index if not exists user_roles_user_active_idx
  on public.user_roles (user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------
-- 3. 기존 users.role 을 user_roles 로 1회 이관
--    users.role 은 호환용으로 남겨두되 deprecated 다.
-- ---------------------------------------------------------------------
insert into public.user_roles (user_id, role_code, scope_type, memo)
select u.id,
       case when u.role = 'admin' then 'PLATFORM_ADMIN' else 'CUSTOMER' end,
       'platform',
       'users.role 에서 자동 이관 (002_rbac.sql)'
from public.users u
where not exists (
  select 1 from public.user_roles ur
  where ur.user_id = u.id and ur.revoked_at is null
);

-- =====================================================================
-- 운영 참고
-- =====================================================================
-- [특정 아이디에 플랫폼 관리자 권한 부여]
--   insert into public.user_roles (user_id, role_code, scope_type)
--   select id, 'PLATFORM_ADMIN', 'platform'
--   from public.users where user_id = 'admin'
--   on conflict do nothing;
--
-- [권한 회수]
--   update public.user_roles set revoked_at = now()
--   where user_id = (select id from public.users where user_id = 'admin')
--     and role_code = 'PLATFORM_ADMIN' and revoked_at is null;
--
-- [현재 활성 권한 확인]
--   select u.user_id, u.name, ur.role_code, ur.scope_type, ur.granted_at
--   from public.user_roles ur
--   join public.users u on u.id = ur.user_id
--   where ur.revoked_at is null
--   order by u.user_id;
--
-- ⚠️ RLS 는 아직 적용되지 않았다. 다음 단계(Supabase Auth 전환)에서 처리한다.
--    지금은 anon 키로 user_roles 를 직접 조작할 수 있으므로, 이 테이블은
--    화면 분기의 근거일 뿐 실제 보안 경계가 아니다.
-- =====================================================================

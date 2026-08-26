# Supabase Database Schema (SSOT)

**Version: 1.3.0 (권한 테이블 도입)**

## 1.3.0 변경 사항

- `role_definitions`, `user_roles` 테이블을 신설한다. 권한은 코드에 하드코딩하지 않고
  데이터로 관리하며, 아이디별 권한 부여는 `user_roles` INSERT 한 건으로 처리한다.
- 권한은 `scope_type`(platform | brand | branch)과 `scope_id`로 범위를 갖는다.
  `brands`/`branches` 테이블이 아직 없으므로 현재는 `platform` 범위만 동작하며,
  `scope_id`는 FK 없는 UUID 컬럼으로 준비만 해 둔다.
- 권한 회수는 삭제가 아니라 `revoked_at` 설정이다. 부여·회수 이력을 보존한다.
- `users.role`은 호환용으로 유지하되 deprecated다. `user_roles`에 행이 없는 계정은
  `users.role`을 fallback으로 해석한다(`admin` -> `PLATFORM_ADMIN`, `user` -> `CUSTOMER`).

## 1.2.0 변경 사항

- `admin_barcodes`, `app_settings` 테이블을 신설한다. 기존에 localStorage에만 저장되던
  관리자 사전 등록 바코드와 입금 계좌 정보를 DB로 옮긴다.
- `rooms`는 스키마에 존재했으나 프론트엔드가 사용하지 않았다. 이제 DB를 SSOT로 사용한다.
- 회원 정보 갱신은 `insert`가 아니라 `update ... where user_id = ?`로 처리한다.
  (`user_id`가 UNIQUE이므로 기존 `insert` 방식은 항상 실패했다.)
- `users.id`는 클라이언트가 `crypto.randomUUID()`로 발급한 값을 그대로 사용한다.
  DB가 별도 id를 발급하면 로컬 상태와 어긋나기 때문이다.
- localStorage는 오프라인 캐시 전용이며, 모든 쓰기의 SSOT는 DB다.

## 예약 v1 멀티테넌트 확장 원칙

- 계층은 `brands -> branches -> spaces`이며 모든 운영 데이터는 `branch_id`를 가진다.
- 기존 `rooms`는 운영 마이그레이션에서 `spaces`로 전환한다. 프론트엔드 호환 기간에는 `Room` 명칭을 유지한다.
- `reservations`에는 `branch_id`, `customer_id`, `status`, `created_by`, `updated_at`을 추가한다.
- 동일 공간의 활성 예약 시간 중복은 PostgreSQL exclusion constraint로 최종 차단한다.
- 예약 생성·포인트 차감·`reservation_events` 기록은 `create_reservations_v1` RPC 한 트랜잭션에서 처리한다.
- RLS는 고객 본인 데이터, 관리자의 소속 브랜드/지점 데이터만 허용한다.

## 1. users (회원 테이블)
- `id`: UUID (PK)
- `user_id`: TEXT (UNIQUE)
- `password`: TEXT
- `name`: TEXT
- `phone`: TEXT
- `role`: TEXT ('user' | 'admin')
- `points`: INTEGER
- `created_at`: TIMESTAMPTZ

## 2. rooms (공부방 테이블)
- `id`: TEXT (PK)
- `name`: TEXT
- `capacity`: INTEGER
- `description`: TEXT

## 3. master_barcodes (대표 출입 바코드 테이블)
- `id`: UUID (PK)
- `type`: TEXT ('number' | 'image')
- `value`: TEXT
- `updated_at`: TIMESTAMPTZ

## 4. reservations (예약 테이블)
- `id`: TEXT (PK)
- `room_id`: TEXT (FK -> rooms.id)
- `date`: TEXT
- `start_time`: TEXT
- `end_time`: TEXT
- `user_name`: TEXT
- `user_phone`: TEXT
- `cost_points`: INTEGER
- `cost_amount`: INTEGER
- `payment_method`: TEXT ('points' | 'bank_transfer')
- `payment_status`: TEXT ('paid' | 'deposit_pending')
- `barcode_id`: TEXT
- `barcode_status`: TEXT ('valid' | 'used' | 'cancelled')
- `is_long_term`: BOOLEAN
- `created_at`: TIMESTAMPTZ

## 5. point_transactions (포인트 입출금 및 환불 트랜잭션)
- `id`: TEXT (PK)
- `user_id`: TEXT
- `user_name`: TEXT
- `type`: TEXT ('charge_request' | 'charge_approved' | 'use' | 'refund')
- `amount`: INTEGER
- `description`: TEXT
- `status`: TEXT ('pending' | 'completed' | 'cancelled')
- `created_at`: TIMESTAMPTZ

## 6. admin_barcodes (관리자 사전 등록 바코드)
- `id`: TEXT (PK)
- `barcode_id`: TEXT (UNIQUE) — 예: `*M091063684*`
- `status`: TEXT ('available' | 'assigned' | 'used')
- `assigned_to_user_name`: TEXT NULL
- `assigned_reservation_id`: TEXT NULL
- `created_at`: TIMESTAMPTZ

## 7. app_settings (단일값 운영 설정)
- `key`: TEXT (PK) — 예: `bank_info`
- `value`: JSONB
- `updated_at`: TIMESTAMPTZ

`bank_info` 값의 형태:

```json
{ "bankName": "신한은행", "accountNumber": "110-384-918234", "accountHolder": "(주)르하임 여의도점" }
```

향후 지점별 설정이 필요해지면 `branch_id`를 추가하고 PK를 `(branch_id, key)`로 확장한다.

## 8. role_definitions (권한 정의)
- `code`: TEXT (PK) — `PLATFORM_ADMIN` | `BRAND_ADMIN` | `BRANCH_OWNER` | `BRANCH_ADMIN` | `STAFF` | `CUSTOMER`
- `name`: TEXT — 표시용 한국어 명칭
- `scope_level`: TEXT ('platform' | 'brand' | 'branch') — 이 권한이 가질 수 있는 범위
- `rank`: INTEGER — 클수록 상위 권한. 권한 부여 가능 여부 판정에 사용

## 9. user_roles (아이디별 권한 부여)
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id, ON DELETE CASCADE)
- `role_code`: TEXT (FK -> role_definitions.code)
- `scope_type`: TEXT ('platform' | 'brand' | 'branch')
- `scope_id`: UUID NULL — `platform`이면 NULL. 향후 `branches.id` 등을 FK로 연결
- `granted_by`: UUID NULL (FK -> users.id) — 부여한 관리자
- `granted_at`: TIMESTAMPTZ
- `revoked_at`: TIMESTAMPTZ NULL — NULL이면 활성 권한
- `memo`: TEXT NULL

제약:

- `CHECK`: `scope_type = 'platform'`이면 `scope_id IS NULL`, 그 외에는 `NOT NULL`
- `UNIQUE INDEX (user_id, role_code, scope_type, coalesce(scope_id, '0000…')) WHERE revoked_at IS NULL`
  — 동일 범위의 활성 권한 중복 방지

관리자 부여 예:

```sql
insert into user_roles (user_id, role_code, scope_type)
select id, 'PLATFORM_ADMIN', 'platform' from users where user_id = 'admin';
```

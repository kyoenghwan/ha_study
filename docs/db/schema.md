# Supabase Database Schema (SSOT)

**Version: 1.1.0 (예약 v1 설계)**

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

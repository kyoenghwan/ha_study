# Supabase Database Schema (SSOT)

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


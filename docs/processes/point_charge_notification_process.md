# 포인트 충전 신청 알림 프로세스

## 목적

회원의 포인트 충전 신청을 해당 지점 담당자에게만 알리고, Telegram 봇 토큰을 브라우저에 노출하지 않는다.

## 처리 흐름

1. 회원이 선택 지점과 충전 금액으로 신청한다.
2. `point_transactions`에 `branch_id`, `charge_request`, `pending` 상태로 저장한다.
   - 운영 DB에 `branch_id` 마이그레이션이 아직 적용되지 않은 경우 description의 `__branch_id=...__` 표식을 임시 호환 경로로 사용한다.
3. 저장 성공 후 `FA_NOTIFICATION_SEND_CHARGE_REQUEST`가 Edge Function을 호출한다.
4. Edge Function은 DB에서 신청을 다시 검증하고 `lheureux_users_meta`의 담당 지점과 Chat ID를 조회한다.
5. `notification_deliveries`로 중복 여부를 확인한 후 Telegram을 발송하고 결과를 기록한다.
6. 관리자 PWA는 `point_transactions` INSERT를 구독한다.
7. `RA_NOTIFICATION_CAN_RECEIVE_BRANCH` 검증을 통과한 담당 관리자에게만 토스트와 브라우저 알림을 표시한다.
8. 회원에게는 관리자 토스트 대신 공통 중앙 다이얼로그로 접수 완료를 표시한다.

## 실패 처리

- 신청 DB 저장 실패: 회원에게 실패 다이얼로그를 표시하고 알림을 호출하지 않는다.
- 담당자 Chat ID 없음: `skipped` 이력을 남기며 다른 지점이나 최고관리자 Chat ID로 우회하지 않는다.
- Telegram 실패: `failed`와 오류 내용을 기록한다. 신청 데이터는 유지한다.
- 중복 호출: 이미 `sent` 또는 `processing` 상태이면 다시 발송하지 않는다.

## 운영 설정

- Supabase Secret: `TELEGRAM_BOT_TOKEN`
- 마이그레이션: `docs/db/migrations/004_point_notification.sql`
- Edge Function: `supabase/functions/telegram-notification/index.ts`

기존에 프론트엔드에 노출된 Bot Token은 폐기하고 새 토큰을 Secret으로 등록해야 한다.

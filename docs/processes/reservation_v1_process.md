# 예약 시스템 v1 프로세스

## 범위

르하임의 복수 지점과 지점별 공간을 전제로 고객 예약 생성·조회·취소, 관리자 예약 변경·취소 및 시간 차단을 지원한다. 예약과 실제 이용 세션은 별도 도메인으로 유지하며, v1에서는 결제·키오스크·이용 세션을 확장 지점으로만 둔다.

## 핵심 불변 조건

- 예약은 `branch_id`와 `space_id`에 귀속된다.
- 시작 시각은 종료 시각보다 빨라야 하며 30분 단위이다.
- 취소되지 않은 같은 공간의 예약은 시간이 겹칠 수 없다.
- 고객 예약은 과거 시각에 생성할 수 없다.
- 결제 금액과 포인트는 서버가 요금 정책으로 계산한다.
- 예약 생성과 포인트 차감 및 변경 이력 기록은 하나의 DB 트랜잭션으로 처리한다.
- 예약 취소는 삭제가 아니라 상태 변경이며 이력을 보존한다.

## 고객 예약 생성 흐름

```text
Scheduler(TA)
  -> FA_CREATE_RESERVATIONS
     -> RA_CAN_CREATE_RESERVATION
     -> RA_VALIDATE_RESERVATION_SLOTS
     -> QA_FIND_RESERVATION_CONFLICTS
     -> OA_CREATE_RESERVATIONS (DB RPC)
        -> reservations INSERT
        -> point balance UPDATE (포인트 결제 시)
        -> reservation_events INSERT
  -> UI 상태 갱신
```

DB 쓰기는 `create_reservations_v1` RPC 내부 트랜잭션을 SSOT로 한다. 현재 프론트엔드의 로컬 저장 모드는 동일한 RA/FA 검증 결과를 적용하되, 운영 전환 전에는 RPC 구현과 RLS 적용이 필수다.

## 상태 전이

```text
PENDING_PAYMENT -> CONFIRMED -> CHECKED_IN -> COMPLETED
       |               |
       +-----> CANCELLED <-----+
```

## 권한

- CUSTOMER: 공개된 지점·공간·가용 시간 조회, 본인 예약 생성·조회·취소
- STAFF/BRANCH_ADMIN: 소속 지점 예약 조회·생성·변경·취소·시간 차단
- BRAND_ADMIN: 소속 브랜드 전체 지점
- PLATFORM_ADMIN: 전체 플랫폼


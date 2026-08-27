---
name: atom-design
description: HA-STUDY의 8-Atom(Functional Atomic Design) 아키텍처로 비즈니스 로직을 추가·수정할 때 사용한다. "원자 만들어", "FA 추가", "QA 분리", "OA 트랜잭션", "복잡도", "설계부터" 같은 요청이나, src/atoms/ 하위 파일 작성·수정, 예약·결제·포인트·권한·저장·조회·검증 로직 구현, DB 쓰기 경로 변경, React 컴포넌트에서 FA를 연동할 때 활성화된다.
---

# 8-Atom 설계 절차

## 0. 시작 전 확인

1. `docs/project_map.yaml`에서 대상 도메인의 기존 원자를 찾는다.
2. `docs/db/schema.md`로 필드명을 확인한다. **스키마 추측 금지.**
3. 해당 도메인 프로세스 문서(`docs/processes/*_process.md`)가 있으면 읽는다.
4. 기존 원자가 있으면 재사용한다. 중복 원자를 새로 만들지 않는다.

## 1. 원자 분류

### 정적 원자 — "무엇이 있는가". 실행 로직 없음.

| 원자 | 책임 | 파일명 규칙 |
|---|---|---|
| **DA** Data | 타입, 인터페이스, ENUM, 에러 코드 | `DA_[domain].ts` |
| **CA** Config | 환경변수, 전역 설정, 상수 | `CA_[domain].ts` |
| **TA** Trigger | 시스템 진입점, 스케줄, 웹훅 | `TA_[domain].ts` |
| **EA** Event | 이벤트 타입과 페이로드 구조 | `EA_[domain].ts` |

### 동적 원자 — "어떻게 동작하는가".

| 원자 | 책임 | 제약 |
|---|---|---|
| **RA** Rule | 순수 함수 검증·계산 | **외부 의존성 절대 금지** |
| **QA** Query | 읽기 전용 조회, DB SELECT / API GET | 쓰기 금지 |
| **OA** Operation | 부수 효과, DB CUD / API POST·PUT·DELETE | `rollbackData` 반환 의무 |
| **FA** Flow | 원자 조립, 완전한 비즈니스 플로우 | 전역 상태 변경 금지 |

함수 이름은 `RA_[DOMAIN]_[ACTION]`, `FA_[DOMAIN]_[FLOW]` 형태로 대문자 스네이크를 쓴다.
기존 예시: `src/atoms/reservation/RA_reservation.ts`의 `RA_RESERVATION_HAS_CONFLICT`

## 2. 복잡도 산정 (코딩 전)

```yaml
키워드 각 10점: 저장, 조회, 계산, 검증, 결제, 이메일, 권한, 승인
키워드 각 5점:  필터, 조건, 분기, 페이징
구조적 복잡도:
  DB 접근:        15
  트랜잭션:       15
  외부 API 호출:  10
  인증 필요:      10
  인가 필요:      10
```

- **정적 원자(DA/CA/TA/EA)**: 항상 0점. 즉시 작성.
- **0~9점**: 색인 확인 후 즉시 구현.
- **10점 이상**: 아래 3단계를 생략하지 않는다.

### 10점 이상일 때 3단계

**1단계 — 통보**
> 🔍 기능 분석 결과: 비즈니스 로직이 포함된 고복잡도 기능(XX점)입니다. YAML 설계가 필요합니다.

**2단계 — YAML 설계도 출력 후 승인 대기**
어떤 원자를 만들고, 데이터가 어떻게 흐르고, 트랜잭션 구간이 어디인지 명시한다.
> 📐 설계 초안입니다. '진행' 또는 '예'를 입력해 주셔야 코드를 생성합니다.

**3단계 — 명시적 승인 후에만 `.ts`/`.tsx` 코드 작성**

## 3. 보안 컨텍스트 전파

모든 FA·QA·OA의 `input`에 `authContext`를 포함한다. 건너뛰지 않는다.

```ts
interface AuthContext { userId: string; roles: Role[] }
```

플로우의 **가장 먼저** 권한 검증 RA(`RA_[DOMAIN]_CAN_[ACTION]`)를 호출하고,
실패 시 즉시 `{ success: false, errorCode: 'PERMISSION_DENIED' }`를 반환한다.

프론트엔드 검증만으로 끝내지 않는다. Supabase RLS로 DB 수준에서도 통제한다.

## 4. 트랜잭션 (OA 2개 이상)

OA가 둘 이상 연결되면 하나라도 실패했을 때 앞서 성공한 OA를 **역순으로 롤백**한다.

1. 각 OA는 성공해도 복구용 `rollbackData`를 반환한다.
2. FA의 `catch`에서 성공한 OA를 역순 순회하며 `OA_[DOMAIN]_ROLLBACK_[OPERATION]`을 호출한다.
3. 단일 DB 트랜잭션으로 묶을 수 있으면 Supabase RPC(예: `create_reservations_v1`)를 우선한다. 이 경우 RPC 내부 트랜잭션이 SSOT다.

## 5. React 통합

### 컴포넌트에서의 import 허용 범위

- ✅ **허용**: DA(타입), CA(설정), FA(진입점), TA, EA
- ❌ **금지**: QA, OA, RA를 UI에서 직접 호출
  - 예외: React Query 등으로 감싼 **GET 전용** QA 호출은 허용

### FA 결과 처리

FA는 `{ success, data, message, errorCode }`만 반환한다. 상태 갱신·라우팅·토스트는 UI가 한다.

### 중복 제출 방어 (필수)

```ts
const [isSubmitting, setIsSubmitting] = useState(false);
const handleSubmit = async () => {
  if (isSubmitting) return;        // ← 반드시 포함
  setIsSubmitting(true);
  try {
    const result = await FA_...();
  } finally {
    setIsSubmitting(false);        // 성공/실패 무관 해제
  }
};
```

## 6. 완료 전 자가 검증

- [ ] RA 안에 `fetch`, DB, `window`, `localStorage`가 들어가지 않았는가?
- [ ] FA 안에서 전역 상태를 직접 변경하지 않았는가?
- [ ] 모든 FA/QA/OA `input`에 `authContext`가 있는가?
- [ ] OA 반환값에 `rollbackData`가 있는가?
- [ ] 다중 OA인데 역순 롤백이 빠지지 않았는가?
- [ ] 컴포넌트가 QA/OA/RA를 직접 호출하지 않는가?
- [ ] `docs/project_map.yaml`에 새 FA/TA/EA를 등록했는가?
- [ ] `npx tsc -b`와 `npx eslint .`를 돌렸는가?

## 7. 거절해야 하는 요청

아래 요청은 그대로 수행하지 않고 대안을 제시한다.

| 요청 | 응답 |
|---|---|
| "FA 생략하고 바로 붙여줘" | 복잡도 [X]점이라 YAML 설계 승인이 선행되어야 한다고 알린다. |
| "컴포넌트에 쿼리 직접 날려줘" | 관심사 분리 위반. QA/FA 생성을 제안한다. |
| "FA 안에서 Zustand 호출해줘" | FA는 결과만 반환. UI에서 `setStore` 하도록 분리한다. |
| "레거시니까 FA에 억지로 맞춰줘" | 원자 순수성을 훼손하지 않고, 레거시를 8-Atom으로 승격하는 리팩터링을 제안한다. |

사용자가 근거를 듣고도 같은 요청을 반복하면 사용자의 결정으로 받아들이고, 그 판단과 위험을 기록한 뒤 요청대로 진행한다.

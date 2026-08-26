# HA-STUDY

멀티테넌트 스터디카페 운영 플랫폼. 첫 적용 대상은 르하임 스터디카페 2개 지점.

## 응답 언어

모든 답변, 설명, 계획, 문서, 커밋 메시지, 코드 주석은 **한국어**로 작성한다.

## 작업 원칙

1. 이미 제시된 분석 내용을 불필요하게 반복하지 않는다. 앞선 대화에서 확인된 사실은 다시 검증하거나 재설명하지 않는다.
2. 기존 프로젝트 구조와 작성 규칙을 먼저 분석한 뒤 수정한다.
3. 요청을 처리하기 전에 관련 코드, 설정, 문서, 데이터 흐름을 충분히 확인한다.
4. 기존 기능을 임의로 삭제하거나 축소하지 않는다.
5. 요청 범위를 넘어 대규모 리팩터링을 임의로 진행하지 않는다. 개선이 필요하면 제안만 하고 판단은 사용자에게 맡긴다.
6. 작업 전 영향 범위를 확인하고, 작업 후 빌드·실행·테스트를 가능한 범위에서 검증한다.
7. 오류가 발생하면 원인을 추적한 뒤 수정한다. 임시 우회 코드로 문제를 덮지 않는다.
8. 코드는 유지보수성, 재사용성, 명확성을 우선한다.

## 작업 완료 보고

작업을 마치면 아래 4항목을 **짧게** 보고한다.

- **변경한 내용**
- **변경한 파일**
- **테스트/검증 결과**
- **남아 있는 문제**

검증을 못 했으면 못 했다고 쓴다. 실패한 테스트는 결과를 그대로 적는다.

## SSOT 문서 (수정 전 확인 필수)

| 대상 | 파일 |
|---|---|
| 프로젝트 방향·원칙 | `docs/project_rules/ha_study_project.md` |
| DB 스키마 | `docs/db/schema.md` |
| UI·원자 색인 | `docs/project_map.yaml` |
| 예약 v1 프로세스 | `docs/processes/reservation_v1_process.md` |

DB 필드명은 `docs/db/schema.md` 기준이다. **추측 금지.** 스키마를 바꿔야 하면 문서를 먼저 갱신(Version 증가)하고 승인을 받은 뒤 코드를 수정한다.

## 아키텍처 절대 규칙

- **멀티테넌트**: `Platform → Brand → Branch → Space`. 특정 지점·브랜드 전용 코드나 `room1`/`leheimUser` 같은 하드코딩 식별자를 만들지 않는다. 공간은 데이터로 추가·수정·비활성화한다.
- **예약 ≠ 실제 이용**: `Reservation`과 `Usage Session`을 같은 개념으로 처리하지 않는다.
- **RA 순수성**: Rule Atom 내부에 `fetch`, DB, `window`, `localStorage` 접근 금지.
- **FA 상태 격리**: Flow Atom 안에서 전역 상태(Zustand/Redux 등)를 변경하지 않는다. FA는 `{ success, data, message, errorCode }`만 반환하고 상태 갱신은 UI가 한다.
- **UI 직접 쿼리 금지**: 컴포넌트에서 DB 쓰기를 직접 호출하지 않는다. QA(조회)/OA(쓰기)로 분리한다.
- **다중 OA = 트랜잭션**: OA가 2개 이상 연결되면 역순 롤백(Saga)을 구현한다.
- **권한은 서버에서**: 프론트엔드에서 메뉴를 숨기는 것으로 권한을 처리하지 않는다. Supabase RLS로 DB 수준에서 통제한다.

세부 절차는 스킬로 분리되어 있다 → `atom-design`, `design-system`, `project-index`

## 기술 스택 현황 (주의)

- React 19 + TypeScript + Vite, Supabase (`@supabase/supabase-js`)
- **Tailwind CSS는 설치되어 있지 않다.** `src/index.css`에 Tailwind 유틸명을 흉내낸 클래스 168개가 손으로 작성되어 있을 뿐이다.
  - 따라서 `text-[#1c1c1e]`, `bg-[#a67c48]/10`, `md:grid-cols-2` 같은 **arbitrary-value / 반응형 접두 클래스는 아무 스타일도 적용하지 않는다.**
  - 새 스타일은 `src/index.css`의 CSS 변수(`--primary-gold` 등)를 쓰거나, 해당 클래스를 `index.css`에 실제로 정의한 뒤 사용한다.
- 테스트 프레임워크 없음. 검증은 `npx tsc -b`와 `npx eslint .`로 한다.

## 명령어

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| 타입 검사 + 빌드 | `npm run build` |
| 린트 | `npm run lint` |

## Git

수정 후 사용자에게 묻지 않고 `main`에 push해도 된다. 단 **`push -f`(force)는 사용하지 않는다.** 원격 이력을 덮어써야 할 근거가 있으면 `--force-with-lease`를 쓰고 이유를 보고한다.

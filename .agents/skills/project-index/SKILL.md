---
name: project-index
description: HA-STUDY의 색인 맵·DB 스키마·프로세스 문서를 조회하거나 갱신할 때 사용한다. 새 페이지·모달·주요 UI 요소 생성, 컴포넌트 파일 경로 변경, FA/TA/EA 추가, DB 테이블·컬럼 추가·변경, 새 도메인 기능 착수, "스키마 바꿔", "색인", "project_map", "프로세스 문서" 같은 요청 시 활성화된다.
---

# 색인 및 문서 SSOT 관리

## SSOT 위치

| 대상 | 파일 | 성격 |
|---|---|---|
| UI·원자 색인 | `docs/project_map.yaml` | 어떤 요소가 어디 있는지 |
| DB 스키마 | `docs/db/schema.md` | 필드명의 유일한 근거 |
| 프로세스 청사진 | `docs/processes/[이름]_process.md` | 도메인 흐름·불변조건 |
| 프로젝트 특수 지침 | `docs/project_rules/ha_study_project.md` | 범용 원칙보다 우선 |

## 우선순위

```
8-Atom 체계 순수성  (절대 불변)
        ↓
docs/project_rules/ (최우선)
        ↓
AGENTS.md + 스킬     (기본)
```

## UI 수정 표준 절차

1. **색인 검색** — `docs/project_map.yaml`에서 대상 요소를 찾는다.
2. **파급 범위 확인** — 공유 스타일 그룹이면 "단일 vs 일괄"을 사용자에게 묻는다.
3. **특수 지침 적용** — 관련 `project_rule`이 있으면 먼저 로드한다.
4. **색인 누락 대응** — 대상이 색인에 없으면 엔트리를 먼저 만들고 승인을 받은 뒤 코드를 수정한다.

색인에서 대상을 특정했으면 아래 형식으로 확인한다.

```
📌 색인 확인 결과
- 요소명: [ELEMENT_NAME]
- 위치: [파일경로]
- 스타일 그룹: [있음/없음]
- 반응형 변형: [mobile/desktop/없음]
- 특수 지침: [있음/없음]

이 대상을 수정하는 것이 맞습니까?
```

요청이 명확해서 대상이 하나로 특정되면 이 확인은 생략하고 진행한다.
후보가 둘 이상이거나 파급 범위가 넓을 때만 묻는다.

## 색인 갱신이 필수인 상황

다음은 **코드보다 색인을 먼저** 갱신한다.

- 새 페이지 / 모달 / 주요 UI 섹션 생성
- 컴포넌트 파일 경로 변경
- FA / TA / EA 추가·변경
- 공유 스타일 그룹 또는 특수 지침 구조 변경

절차: 엔트리 초안 → 사용자 승인 → 코드 구현

### `project_map.yaml` 현재 구조

```yaml
version: 1
project_rule: docs/project_rules/ha_study_project.md
domains:
  [도메인명]:
    process: docs/processes/[이름]_process.md
    schema: docs/db/schema.md
    atoms:
      data:   src/atoms/[도메인]/DA_*.ts
      config: src/atoms/[도메인]/CA_*.ts
      rules:  src/atoms/[도메인]/RA_*.ts
      flow:   src/atoms/[도메인]/FA_*.ts
    ui:
      [화면키]:
        file: src/components/[파일].tsx
        responsive_variants: [mobile, desktop]
```

기존 구조를 따른다. 새 키를 임의로 발명하지 않는다.

## DB 스키마 변경 절차

**필드명 추측을 절대 금지한다.** `docs/db/schema.md`가 유일한 근거다.

1. `docs/db/schema.md` 갱신 — 버전 번호를 올린다 (현재 1.1.0).
2. 사용자 승인.
3. DA / QA / OA 코드 수정.
4. 기존 데이터 마이그레이션 영향을 함께 확인해 보고한다.

### 현재 스키마의 알려진 불일치

`docs/db/schema.md` 상단은 `brands → branches → spaces` 계층과
`reservations.branch_id`, `status`, `created_by`, `updated_at`, exclusion constraint,
`create_reservations_v1` RPC를 원칙으로 선언한다.

그러나 같은 문서 하단의 실제 테이블 정의는 `rooms`와 `branch_id` 없는 `reservations`이며,
코드도 그쪽을 따른다. 스키마 작업 시 **이 불일치를 인지하고**, 어느 쪽으로 정렬할지
사용자에게 확인한 뒤 진행한다.

## 프로세스 청사진

새 도메인이나 큰 기능은 **코드보다 프로세스 문서를 먼저** 쓴다.

경로: `docs/processes/[프로세스명]_process.md`

포함 항목 (`reservation_v1_process.md` 참고):

- 범위
- 핵심 불변 조건
- 흐름도 (TA → FA → RA/QA/OA 연결)
- 상태 전이
- 권한별 허용 범위
- 트랜잭션 구간

## 특수 지침 생성 제안 트리거

다음을 감지하면 `docs/project_rules/`에 특수 지침을 추가할 것을 제안한다.

- 여러 컴포넌트가 동일한 제약을 공유해야 할 때
- "항상 같이 움직여야 해" 류의 도메인 제약이 언급될 때
- 범용 원칙보다 엄격한 규칙이 반복될 때

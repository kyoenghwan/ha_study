# Part 2: 8-Atom 명세 & 트랜잭션 처리 원칙

## 2.1 원자 분류 개요 (완전한 8-Atom 시스템)

8-Atom 체계는 모든 코드를 역할에 따라 8가지 원자 단위로 분류하여 관리합니다. 각 원자는 단 하나의 책임만 가지며, 이를 벗어나는 코드는 즉시 분리해야 합니다.

### 정적 원자 (Static Atoms) - 4개
"무엇이 있는가"만 정의하며, 실행 로직은 절대 포함하지 않습니다.

- **1. DA (Data Atom)** - 데이터 타입, 인터페이스, ENUM, 에러 코드 정의
- **2. CA (Config Atom)** - 환경변수, 전역 설정값, 상수 정의  
- **3. TA (Trigger Atom)** - 시스템 진입점, 스케줄, 웹훅 정의
- **4. EA (Event Atom)** - 시스템 이벤트 타입과 페이로드 구조 정의

### 동적 원자 (Dynamic Atoms) - 4개  
"어떻게 동작하는가"를 실제 코드로 구현합니다.

- **5. RA (Rule Atom)** - 순수 함수, 외부 의존성 절대 금지
- **6. QA (Query Atom)** - 읽기 전용 조회, DB/외부 API GET
- **7. OA (Operation Atom)** - 부수 효과, DB CUD/외부 API POST·PUT·DELETE  
- **8. FA (Flow Atom)** - 원자 조립, 완전한 비즈니스 플로우 구현

---

## 2.2 [AI 절대 지침] 코드 템플릿 참조 강제 (중요)

> **[AI 절대 지침: 템플릿 지연 로딩]**
> 위 8-Atom 아키텍처를 기반으로 TypeScript 코드를 신규 작성하거나 구조를 대규모로 수정해야 할 경우, **본격적인 코딩을 시작하기 전, 반드시 파일 읽기 도구(`view_file`)를 사용하여 `docs/templates/atom_boilerplate_templates.md` 문서를 스캔해야 합니다.**
> 
> 해당 문서에는 FA/OA 롤백 구조, 에러 코드(AtomErrorCode) 반환 형식 등의 필수 보일러플레이트가 포함되어 있습니다. 이 파일 읽기 절차를 생략하고 기억에 의존해 임의로 코딩을 진행하는 행위는 심각한 시스템 원칙 위반으로 간주됩니다.

---

## 2.3 핵심 트랜잭션(Transaction) 처리 원칙 ⭐

FA 내에서 여러 DB 쓰기 작업(OA)이 순차적으로 실행되는 경우, **하나라도 실패하면 앞서 성공한 OA를 반드시 역순으로 롤백**해야 합니다.
이를 위해 다음 원칙을 절대 준수합니다 (코드 템플릿은 부록 파일 참조).

1. **다중 OA = 트랜잭션**: OA가 두 개 이상 연결되면 반드시 트랜잭션 패턴을 적용할 것.
2. **부분 OA의 반환 의무**: 각 OA는 성공하더라도 만약을 대비한 복구 데이터(`rollbackData`)를 필수로 반환 영역에 명시할 것.
3. **역순 롤백(Saga)**: FA는 에러 캐치(`catch`) 부분에서, 앞서 성공한 OA들을 역순으로 순회하며 해당하는 Rollback Atom (`OA_[DOMAIN]_ROLLBACK_[OPERATION]`)을 호출할 것.

---

## 2.4 보안 컨텍스트 전파 표준 ⭐

모든 FA, QA, OA의 매개변수(`input`)에는 반드시 요청자의 권한 정보를 식별할 수 있는 `authContext` 객체가 포함되어야 하며, 이를 건너뛰는 행위를 엄격히 금지합니다.

- 권한 검증 RA (`RA_[DOMAIN]_CAN_[ACTION]`)를 가장 먼저 호출할 것.
- 검증 실패 즉시 `{ success: false, errorCode: 'PERMISSION_DENIED' }`를 반환할 것.

---

## 2.5 요약 (체크리스트)

새로운 원자를 설계/생성할 때 다음 사항을 항상 확인하십시오:
- [ ] 원자 작성이 필요한 경우, `view_file`로 `docs/templates/atom_boilerplate_templates.md`를 열었는가?
- [ ] 함수 내부에 외부 의존성(DB, Fetch, window, LocalStorage)이 들어갔는데 RA로 분류하지는 않았는가?
- [ ] FA(Flow Atom) 안에서 전역 상태 관리 코드(Zustand, Redux)를 직접 호출하지는 않았는가? (UI 컴포넌트로 빼야 함)
- [ ] OA의 반환값에 만약의 사태를 대비한 `rollbackData`가 보장되어 있는가?

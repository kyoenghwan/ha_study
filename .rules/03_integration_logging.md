# Part 3: React/Next.js 통합 & 상태 관리 원칙

## 3.1 8-Atom 체계 기반 React 통합 규칙

### 3.1.1 UI 컴포넌트에서 허용되는 Atom Import
- **✅ 허용 (정적 원자)**: DA(타입), CA(설정), FA(진입점), TA(명시), EA(이벤트)
- **❌ 절대 금지 (동적 원자)**: QA(조회), OA(연산), RA(검증)을 UI 컴포넌트에서 직접 호출 금지. (단, React Query 활용 시 QA 직접 호출은 GET 작업에 한해 예외적 허용)

### 3.1.2 상태 관리(State Management) 절대 원칙 ⭐
**Flow Atom(FA) 내부에서는 Recoil, Zustand, Redux 등 전역 상태 관리 라이브러리를 직접 호출하거나 상태를 변경하는 것을 절대 금지합니다.**
- **FA의 역할**: 오직 `{ success, data, message, errorCode }` 반환
- **UI의 역할**: FA의 결과를 받아 `setStore(...)` 등을 통해 상태 업데이트 및 라우팅

---

## 3.2 UI 및 프론트엔드 작업 지연 로딩 프로토콜

> **[AI 절대 지침: React 패턴 템플릿 참조]**
> UI 컴포넌트에 React Hook을 작성하거나, FA 연동, React Query 뮤테이션, 에러 핸들링 로직을 작성해야 할 때 **반드시 코딩 전 터미널/파일 도구(`view_file`)를 통해 `docs/templates/react_boilerplate_templates.md` 문서를 열어서 읽으십시오.** 
> 임의로 상상하여 폼 리액트 패턴을 짜는 것은 시스템 원칙 위반입니다.

---

## 3.3 Layered Logging System (`nvLog`)

**프레임워크(UI) 영역 - `nvLog('FW', ...)`**
- 컴포넌트 제출, 메뉴 클릭, 렌더링 시작 등을 추적합니다.
- 예: `nvLog('FW', '[폼명] 제출', formData);`

**원자(AT) 영역 - `nvLog('AT', ...)`**
- Atom 체계 내부의 진입, 연산 성공/실패, 롤백을 추적합니다.
- 예: `nvLog('AT', '▶️ FA_[FLOW_NAME] 시작', input);`

---

## 3.4 방어적 컴포넌트 원칙 (동시성 방어)

**UI 레벨 중복 호출 방지 (필수)**
어떤 버튼 클릭이나 폼 제출 시에도 반드시 `isSubmitting` 검사를 통해 사용자의 다중 클릭/요청을 프레임워크 타임에서 블로킹해야 합니다.

~~~typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const handleSubmit = async () => {
  if (isSubmitting) return; // ← 반드시 포함
  setIsSubmitting(true);
  try {
    const result = await FA_[FLOW_NAME]();
  } finally {
    setIsSubmitting(false); // 성공/실패 무관 반드시 해제
  }
};
~~~

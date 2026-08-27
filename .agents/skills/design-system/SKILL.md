---
name: design-system
description: HA-STUDY의 UI 스타일·레이아웃·색상·간격·타이포그래피를 작성하거나 수정할 때 사용한다. "디자인", "스타일", "색상 바꿔", "간격", "폰트", "반응형", "모바일", "버튼/카드/모달 만들어" 같은 요청이나, src/components/ 하위 .tsx의 className 수정, src/index.css·src/App.css 편집, 새 화면·컴포넌트 UI 구현 시 활성화된다.
---

# HA-STUDY 디자인 시스템

## ⚠️ 먼저 알아야 할 것: Tailwind는 설치되어 있지 않다

`package.json`에 `tailwindcss` 의존성이 없고 config도 플러그인도 없다.
`src/index.css`에 Tailwind 유틸명을 흉내낸 클래스가 **손으로** 정의되어 있을 뿐이다.

따라서 다음은 **아무 스타일도 적용하지 않는다**:

| 형태 | 예시 | 상태 |
|---|---|---|
| arbitrary value | `text-[#1c1c1e]`, `bg-[#a67c48]/10`, `text-[10px]`, `max-w-[250px]` | ❌ 무효 |
| 반응형 접두 | `md:grid-cols-2`, `lg:flex`, `sm:hidden` | ❌ 무효 |
| 미정의 유틸 | `bg-gradient-to-r`, `backdrop-blur-sm`, `divide-y`, `hidden`, `grid-cols-1`, `hover:*`, `group-hover:*` | ❌ 무효 |

현재 코드베이스에 이런 무효 클래스가 다수 남아 있다. **새로 추가하지 않는다.**

### 스타일을 넣는 올바른 방법

우선순위대로 시도한다.

1. `src/index.css`에 **이미 정의된** 클래스를 쓴다. 쓰기 전에 실제로 있는지 확인한다:
   ```bash
   grep -n "^\.클래스명" src/index.css src/App.css
   ```
2. 없으면 `src/index.css`에 CSS 변수를 사용해 **정의를 추가한 뒤** 쓴다.
3. 반응형이 필요하면 유틸 접두사가 아니라 `@media` 블록을 쓴다.
   - 기존 브레이크포인트: `src/index.css`의 `min-width: 501px`, `src/App.css`의 `max-width: 1024px`
4. 인라인 `style={{}}`은 동적 계산값에만 쓴다. 정적 스타일에는 쓰지 않는다.

## 디자인 토큰 (`src/index.css` `:root`)

임의의 색상·크기·간격을 새로 만들지 않는다. 아래 변수를 쓴다.

```
배경    --bg-app, --bg-container, --bg-card, --bg-card-hover, --bg-input
브랜드  --primary-gold, --primary-gold-hover, --accent-gold, --gold-light, --gold-border
텍스트  --text-primary, --text-secondary, --text-muted
테두리  --border-color, --border-focus
상태    --danger, --danger-light, --success, --success-light, --warning, --warning-light
그림자  --shadow-sm, --shadow-md, --shadow-lg
반경    --radius-sm, --radius-md, --radius-lg, --radius-xl
폰트    --font-sans  (Pretendard → Outfit → system)
```

토큰에 없는 값이 필요하면 하드코딩하지 말고 **토큰 추가 여부를 먼저 사용자에게 확인**한다.

## 공통 컴포넌트 원칙

**페이지는 디자인하는 곳이 아니라 공통 UI를 조립하는 곳이다.**

```
Design Token → 공통 UI Component → HA-STUDY Pattern → Page
```

Button, Input, Select, Card, Modal, Table 같은 기본 요소를 페이지마다 새로 구현하지 않는다.
예약 카드, 공간 카드, 상태 배지, 페이지 헤더, 검색/필터 영역 등 반복 패턴도 공통화한다.

작업 순서:

1. 기존 공통 컴포넌트를 먼저 찾는다.
2. 없으면 페이지에 독립 스타일을 만들지 말고, 공통 컴포넌트로 만들 것을 제안한다.
3. 페이지별로 서로 다른 디자인이 생기는 것을 허용하지 않는다. 모든 화면은 같은 제품처럼 보여야 한다.

### 현재 상태

공통 컴포넌트가 **아직 하나도 없다.** `src/components/`의 5개 파일은 모두 화면 단위이며,
`AdminDashboard.tsx`는 1,585줄 안에서 스타일을 반복한다.
새 UI를 만들 때 이 패턴을 따라가지 말고, 공통 컴포넌트 추출을 제안한다.

## 반응형 원칙

| 사용자 | 우선 화면 | 방향 |
|---|---|---|
| 고객 | 모바일 우선 | 빠른 예약·예약 확인 중심 |
| 지점 관리자 | PC Web 우선 | 넓은 화면에서 현황·회원·통계 관리. 모바일도 사용 가능해야 함 |
| 키오스크 | 향후 전용 레이아웃 | 지금은 구현하지 않음 |

`docs/project_map.yaml`에 `responsive_variants`가 명시된 컴포넌트를 수정할 때는
**어느 뷰포트를 대상으로 하는지 사용자에게 확인**한다 (모바일 / 데스크톱 / 전체).

## 공유 스타일 변경 시

여러 화면이 공유하는 스타일 그룹을 수정할 때는 반드시 물어본다.

> 이 스타일은 [A, B, C] 화면이 공유합니다. **단일 화면만** 수정할까요, **일괄** 수정할까요?

## 완료 전 확인

- [ ] 추가한 className이 `index.css`/`App.css`에 실제로 정의되어 있는가?
- [ ] arbitrary-value(`[...]`)나 `md:`/`lg:` 접두 클래스를 새로 넣지 않았는가?
- [ ] 색상·간격·반경을 하드코딩하지 않고 토큰을 썼는가?
- [ ] 같은 UI가 다른 화면에도 있는데 중복 구현하지 않았는가?
- [ ] `npm run dev`로 실제 렌더 결과를 확인했는가?

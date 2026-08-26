# HA-STUDY — Agent Instructions

이 프로젝트의 개발 지침은 **[CLAUDE.md](./CLAUDE.md)** 에서 관리합니다.

Claude Code 외의 도구(Codex, Cursor 등)를 사용하는 경우에도 작업 전 `CLAUDE.md`를 읽고
그 내용을 따라 주십시오. 지침이 중복 관리되어 서로 어긋나는 것을 막기 위해
이 파일에는 규칙 본문을 두지 않습니다.

## 참조 순서

1. `CLAUDE.md` — 응답 언어, 작업 원칙, 아키텍처 절대 규칙, 기술 스택 현황
2. `docs/project_rules/ha_study_project.md` — 프로젝트 방향 (최우선 특수 지침)
3. `docs/db/schema.md` — DB 스키마 SSOT
4. `docs/project_map.yaml` — UI·원자 색인
5. `.claude/skills/` — 작업 유형별 상세 절차
   - `atom-design` — 8-Atom 아키텍처, 복잡도 산정, 트랜잭션
   - `design-system` — 스타일, 디자인 토큰, 반응형
   - `project-index` — 색인·스키마·프로세스 문서 갱신
6. `.rules/` — 위 스킬의 원본 규칙 문서 (참고용)

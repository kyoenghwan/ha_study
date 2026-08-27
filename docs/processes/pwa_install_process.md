# PWA 설치 프로세스

## 범위

HA-STUDY 웹을 Android, iOS 및 지원 데스크톱 브라우저에서 홈 화면 앱으로 설치할 수 있게 한다. 앱스토어 패키징은 범위에 포함하지 않는다.

## 핵심 조건

- 앱 셸은 서비스 워커로 캐시하되 예약·인증·결제 데이터는 네트워크와 Supabase를 SSOT로 유지한다.
- 설치 가능 이벤트가 발생한 브라우저에서만 네이티브 설치 프롬프트를 호출한다.
- Android 인앱 브라우저에서도 설치 진입점은 표시하되 Chrome 또는 삼성 인터넷으로 여는 방법을 안내한다.
- iOS Safari는 네이티브 프롬프트가 없으므로 `공유 → 홈 화면에 추가` 안내를 제공한다.
- 이미 standalone 모드로 실행 중이면 설치 UI를 숨긴다.
- 앱 아이콘은 기존 르하임 로고 심벌을 사용한다.

## 흐름

```text
브라우저 진입
  -> manifest + service worker 확인
  -> standalone 실행 여부 확인
  -> Android/지원 브라우저: beforeinstallprompt 보관 -> 설치 버튼 -> prompt()
  -> Android 인앱 브라우저: 설치 버튼 -> 외부 브라우저 열기 안내
  -> iOS Safari: 설치 안내 버튼 -> 안내 패널
  -> appinstalled 발생 -> 설치 UI 숨김
```

## 업데이트

`registerType: autoUpdate`로 새 서비스 워커를 자동 활성화한다. 예약 데이터는 캐시 응답으로 대체하지 않는다.

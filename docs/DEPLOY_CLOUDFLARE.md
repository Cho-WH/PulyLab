# Cloudflare Pages + Functions 배포 가이드 (아주 쉽게)

이 문서는 Cloudflare를 처음 쓰는 분과 코딩 입문자도 따라 할 수 있도록, 이 프로젝트를 무료에 가깝게 배포하는 법을 아주 쉽게 설명합니다.

배포하면 다음이 됩니다:
- 정적 웹앱(화면)은 Cloudflare Pages가 전 세계 엣지에서 빠르게 제공
- 백엔드 프록시(HTTP/WS)는 Pages Functions(Workers 런타임)가 처리
- 사용자는 본인의 Gemini API 키를 브라우저에 입력하고 사용(서버는 저장/로깅하지 않음)

---

## 0. 준비물
- Cloudflare 계정(무료): `https://dash.cloudflare.com`
- Node.js 18 이상: `https://nodejs.org`
- 터미널(명령어 입력 도구)

용어 간단히:
- Pages: 정적 사이트(HTML/CSS/JS) 배포 서비스
- Functions: Pages 안에서 동작하는 서버 코드(Workers 런타임)

이 레포 구성 요점:
- 정적 파일 빌드 출력: `dist/`
- Functions(프록시): `functions/api-proxy/[...path].ts`
- 브라우저 보조 스크립트: `public/service-worker.js`, `public/websocket-interceptor.js` (빌드 시 `dist/`로 복사)

---

## 1. 프로젝트 빌드(로컬)
터미널에서 프로젝트 폴더로 이동 후 아래를 순서대로 실행하세요.

```
# 1) 의존성 설치
npm ci

# 2) 빌드 (dist/ 생성)
npm run build
```

빌드가 성공하면 `dist/` 폴더가 생깁니다.

---

## 2. 로컬 프리뷰(선택이지만 추천)
Cloudflare의 미리보기 서버로 로컬 테스트를 해봅니다.

```
# wrangler 설치(한 번만)
npm i -g wrangler

# 로그인(브라우저 팝업 열림)
wrangler login

# Pages 로컬 프리뷰 실행(정적 + functions 함께 동작)
npx wrangler pages dev dist
```

브라우저에서 링크가 열리면:
- 우하단 "키 설정" 버튼을 눌러 본인 Gemini API 키를 입력
- 문제 업로드/대화까지 진행해 `/api-proxy/**` 경로를 통해 정상 동작하는지 확인

잘 되면 Ctrl+C로 프리뷰를 종료합니다.

---

## 3. 실제 배포(가장 쉬운 CLI 방법)
처음 한 번 프로젝트를 만들고, 이후엔 배포만 하면 됩니다.

```
# 1) Pages 프로젝트 생성(최초 1회)
#    <프로젝트명>은 소문자/대시로 간단히(예: ai-tutor)
wrangler pages project create <프로젝트명>

# 2) 배포 (dist/와 functions/를 함께 업로드)
wrangler pages deploy dist --project-name <프로젝트명> --functions ./functions
```

명령이 끝나면 배포 URL이 출력됩니다. 링크를 열어 실제로 동작을 확인하세요.

---

## 4. 대시보드로 배포(대안: Git 연결)
CLI 대신 GitHub를 연결해도 됩니다(선호 시).

- Cloudflare Dashboard → Pages → Create project → Connect to Git
- 빌드 설정
  - Build command: `npm ci && npm run build`
  - Build output directory: `dist`
  - Functions directory: `functions`
  - Compatibility date: 최신 날짜(설정 → Functions에서 지정)
- 저장 후 배포 완료를 기다립니다.

---

## 5. 배포 후 체크리스트
- 서비스 접근: 배포 URL 접속 → "키 설정"에서 API 키 입력
- 네트워크 확인: 모든 API 호출이 `https://<your-domain>/api-proxy/...` 경유
- 스트리밍/채팅: 분석/채팅이 끊김 없이 이어지는지 확인
- 보안 확인: 브라우저 콘솔/로그에 API 키 문자열 노출 없음

---

## 6. 문제가 생길 때(자주 묻는 것)
- 401 Missing API key: 키 미입력/오타. "키 설정"에서 다시 입력하세요.
- 403/404/Permission: 키 권한 또는 경로 오류. 올바른 Gemini API 키인지 확인.
- WebSocket(채팅) 연결 실패: 네트워크 정책/회사 방화벽으로 `wss` 차단인지 확인. 잠시 후 재시도.
- 빌드 실패: Node 18+인지 확인, `npm ci` → `npm run build` 순서로 재시도.
- 함수가 안 잡힘: Pages 프로젝트 설정에 Functions 디렉터리가 `functions`로 되어 있는지 확인. CLI 배포 시 `--functions ./functions` 사용.

---

## 7. 보안/설계(간단한 설명)
- 키 저장: 기본은 세션 메모리, 동의 시에만 localStorage(서버/로그에는 저장하지 않음)
- HTTP 프록시: 헤더 `X-Goog-Api-Key` 우선, 쿼리 `key` 보조 → 업스트림에는 헤더로만 전달(쿼리 키는 제거)
- WS 프록시: `/api-proxy/**` 업그레이드 시 쿼리의 `key` 필수 → 업스트림으로 중계
- 로깅: 키/민감 값은 로그에 남기지 않도록 구현됨(문제 신고 시 키는 가리지 말고 보내지 마세요)

---

## 8. 커스텀 도메인(선택)
Pages 프로젝트 → Custom domains → 원하는 도메인 연결(Cloudflare DNS 사용 권장).

---

## 9. 비용 관련(요약)
- Cloudflare Pages/Functions 무료 요금제로 충분한 테스트·개인 사용 가능
- 대역폭/요청/CPU 시간이 매우 크면 유료 전환 고려

---

## 10. 궁금한 점(Q&A)
- Q: functions는 프론트에 공개되나요?
  - A: 아닙니다. Functions 코드는 Workers 런타임에서 서버측으로 실행됩니다(브라우저로 내려가지 않습니다).
- Q: SYSTEM_PROMPT 같은 상수는 어디에 둬야 하나요?
  - A: 프론트/정적 경로가 아닌 서버측(functions)에서만 import하세요.
- Q: Cloudflare Workers와 Pages Functions 차이는?
  - A: Pages Functions는 Pages에 붙어 있는 Workers입니다. 정적+백엔드를 한 프로젝트로 간단히 운영할 때 쓰면 됩니다.

행운을 빕니다! 문제가 있으면 이 가이드의 체크리스트를 먼저 확인하고, 그래도 안 되면 에러 메시지를 정리해 질문 주세요.


# AGENTS 지침

- 언어는 한국어를 사용합니다.

## 변경 계획: Cloudflare Pages+Functions 전환 + 사용자 입력 키 고도화

목표: 환경변수(`GEMINI_API_KEY`/`API_KEY`) 의존을 제거하고, 사용자가 브라우저에서 입력한 API 키만을 사용하도록 전환한 현재 구조를 Cloudflare Pages(정적) + Pages Functions/Workers(HTTP/WS 프록시)로 이식한다. HTTP/WS 전 구간에서 사용자 키를 안전하게 패스스루하고, 키는 저장/로깅하지 않는다. 본 문서는 “향후 커밋에서 실제 적용할 수정 계획”을 현재 코드 상태를 기준으로 정확히 명시한다.

## 현황 요약(코드 기준)
- 프런트엔드(이미 적용됨)
  - `services/geminiService.ts`: SDK 초기화가 함수형(`getGenAI(apiKey)`)으로 변경되어 빌드타임 env 의존 없음. `analyzeProblem`/`createChatSession` 모두 호출부로부터 `apiKey`를 전달받음.
  - `services/apiKeyStore.ts`: 메모리/로컬스토리지 저장과 간단한 키 유효성 검사 구현됨.
  - `context/ApiKeyContext.tsx`: 전역 `ApiKeyProvider` 제공, 저장/삭제/유효성 노출 구현됨.
  - `components/ApiKeyModal.tsx`: 키 입력/보기 토글/로컬 저장 선택/삭제 UI 구현됨.
  - `App.tsx`: 키 미설정 시 모달 유도 및 동작 차단 처리 구현됨.
- 네트워크 계층(부분 적용)
  - `server/public/service-worker.js`: Google API 호출을 동일 오리진 `/api-proxy/**`로 리라이트. 쿼리의 `key` 값 마스킹 로깅 적용.
  - `server/public/websocket-interceptor.js`: Google WS를 `/api-proxy/**`로 리라이트(키는 쿼리로 전달).
- 서버(Express 프록시, 현행 동작):
  - `server/server.js`: “클라이언트 제공 키 우선”으로 HTTP/WS 프록시 구현됨. 루트 HTML에 SW/WS 스크립트를 항상 주입. 키 미제공 시 401 처리. 일부 로그는 일반화 또는 마스킹.
- 빌드 구성:
  - `vite.config.ts`: 빌드타임 env 주입 없음(이미 제거됨).

## 변경 원칙(Cloudflare 반영)
- 사용자 키는 브라우저에서만 입력·관리(기본 세션 메모리, 동의 시 localStorage). 서버/함수/로그에 저장/출력 금지.
- 프록시는 “클라이언트 제공 키 필수”. 키는 헤더 `X-Goog-Api-Key` 또는 쿼리 `key`로 수신 → 외부 API로 그대로 전달.
- 빌드타임 env 불사용. 런타임 안내/UI 유지.
- HTTP 스트리밍/WS 업그레이드가 Functions/Workers에서 그대로 중계되도록 구현.

## 변경 대상 파일(정확 경로)
- 프런트엔드: `services/geminiService.ts`, `App.tsx`, `components/ApiKeyModal.tsx`, `context/ApiKeyContext.tsx`, `index.html`
- 서비스 워커/WS 인터셉터(정적 에셋로 이관): `server/public/service-worker.js`, `server/public/websocket-interceptor.js`
- 서버/프록시 대체: 신규 `functions/api-proxy/[...path].ts`, `functions/ws-proxy.ts`(Cloudflare Pages Functions/Worker)
- 설정/문서: `wrangler.toml`(선택), `README.md`

## 단계별 구현 계획(코드 기준, 무엇을 실제로 바꿀지)
1) 정적 에셋 이관 및 항상 로드
   - 수정: `index.html`에 서비스 워커 등록 스니펫과 `websocket-interceptor.js` `<script>`를 항상 포함.
   - 이관: `server/public/service-worker.js`, `server/public/websocket-interceptor.js`를 정적으로 서빙되는 위치로 복사(예: 프로젝트 루트 또는 `/public`), `index.html`의 경로를 이에 맞춰 업데이트.
   - 정리: Node 서버의 HTML 주입 로직 의존 제거(Cloudflare Pages는 정적 서빙).

2) Cloudflare Pages Functions로 HTTP 프록시 구현(신규)
   - 추가: `functions/api-proxy/[...path].ts`
     - 키 추출: 헤더 `X-Goog-Api-Key` → 쿼리 `key`(둘 다 없으면 401 JSON: 일반화 메시지).
     - 아웃바운드: 받은 키를 `X-Goog-Api-Key`에 설정, 나머지 헤더는 안전한 범위 내 패스스루.
     - 스트리밍: `fetch` Response.body 스트림을 그대로 반환하여 SSE/청크 유지.
     - 보안: 키/민감 필드는 로그에 남기지 않도록 코드에서 제거/마스킹.
     - CORS: 동일 오리진 사용. 외부 오리진 허용 시에만 `Access-Control-*` 추가.

3) Cloudflare에서 WS 프록시 구현(신규)
   - 추가: `functions/ws-proxy.ts`(또는 `functions/api-proxy/ws.ts`)
     - 업그레이드 처리: 쿼리 `key` 필수 확인(없으면 401 또는 440 종료).
     - 상류: `WebSocketPair`로 `wss://generativelanguage.googleapis.com/...`에 연결, 바이너리/텍스트 프레임 중계.
     - 보안/로그: 쿼리의 `key`는 마스킹 후 로그, 에러 사유는 일반화.

4) Express 서버 퇴역(코드 정리)
   - 생산 배포에서 사용하지 않음. 로컬 개발 보조용으로 유지하거나 `README.md`에 비활성화 명시.
   - 중복/혼선 방지를 위해 루트 HTML 주입 로직 관련 주석·가이드를 업데이트.

5) 로깅/보안 하드닝(프런트/에셋/함수 공통)
   - `service-worker.js`/`websocket-interceptor.js`: 현재 쿼리 마스킹은 유지하되, 과도한 디버그 로그 축소(키 관련 문자열이 절대 평문 노출되지 않도록 유지).
   - Functions: 요청/응답 로깅에서 `X-Goog-Api-Key`/`key` 필드 필터링. 예외 메시지는 키 미포함 일반화.

6) UX/에러 처리 보강(프런트)
   - `services/geminiService.ts#getApiErrorMessage`: 키 오류/권한 오류 분기 추가(예: 401/403 → “키가 없거나 유효하지 않습니다”).
   - 키 미설정 시 배너/모달 유도는 현행 유지.

7) 문서/설정 업데이트
   - `README.md`: Cloudflare Pages+Functions 배포 가이드 추가(라우팅 구조, 최소 코드 스켈레톤, 보안 주의사항, 문제 해결).
   - `wrangler.toml`(선택): Pages 프리뷰/로컬 개발 설정(`compatibility_date` 등) 추가.

## 테스트 계획(수동)
- 프런트 단독(Functions 프리뷰): 키 입력 → 문제 업로드 → 분석/채팅 → 정상 동작.
- 잘못된/누락 키: HTTP 401/WS 업그레이드 거부 확인, 프런트 안내 노출.
- 스트리밍/WS: 긴 응답/연속 프레임이 끊기지 않고 중계되는지 확인.
- 로깅: Cloudflare 로그/브라우저 콘솔 어디에도 키 문자열 평문 노출 없음.

## 마이그레이션/호환성
- ENV 키 폴백 미지원(사용자 입력 키만 지원).
- Node Express 서버는 선택적 로컬 개발 보조용으로만 유지.

## 완료 기준(DoD)
- 빌드/배포가 빌드타임 env 없이 성공하고, 키 미입력 시 친절히 안내.
- 사용자 키 입력 후 HTTP/WS 전 구간이 Cloudflare Functions/Workers 경유로 정상 동작.
- 서버/클라이언트/서비스워커/WS 인터셉터/Functions 로그 어디에도 키가 노출되지 않음.
- `README.md`에 Cloudflare 배포 및 키 흐름이 반영됨.

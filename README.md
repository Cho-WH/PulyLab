# AI Studio Gemini App Proxy Server

This Node.js proxy enables running your AI Studio Gemini app without embedding secrets in code. In this setup, the browser supplies the user's Gemini API key per request; the server does not store or fallback to environment keys.


## Instructions (Cloudflare Pages + Functions)

Cloudflare Pages의 정적 호스팅 + Pages Functions 프록시로 무료에 가깝게 배포할 수 있습니다.

1) 프로젝트 구성 확인
- 정적 자산: `index.html`, `index.tsx`, `App.tsx` 등은 Vite로 빌드합니다.
- 프록시(HTTP/WS): `functions/api-proxy/[...path].ts`가 Google API로의 HTTP/WS를 중계합니다.
- 정적 스크립트: `public/service-worker.js`, `public/websocket-interceptor.js`가 빌드 시 `dist/` 루트로 복사됩니다.

2) 빌드
```
npm ci
npm run build
```
빌드 산출물은 `dist/`에 생성됩니다.

3) Cloudflare Pages 설정
- Framework preset: None
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Functions directory: `functions`
- Compatibility date: 최신 날짜(프로젝트 Settings > Functions에서 설정 가능)

4) 라우팅/동작
- 브라우저는 Google API로 나가는 요청을 모두 동일 오리진 `/api-proxy/**`로 요청합니다.
- Pages Functions가 헤더 `X-Goog-Api-Key` 또는 쿼리 `key`의 사용자 키를 받아 그대로 업스트림에 전달합니다.
- WebSocket은 `wss://<origin>/api-proxy/...`로 업그레이드되어 `wss://generativelanguage.googleapis.com/...`로 프록시됩니다.
- 키는 서버/로그에 저장되지 않습니다. 쿼리/헤더의 키 값은 로깅하지 않도록 설계되었습니다.

5) 보안/주의
- 키는 브라우저에서만 입력/보관(기본 세션, 선택 시 localStorage)됩니다.
- 오류 메시지는 일반화되어 키/프롬프트가 포함되지 않습니다.
- 공용 PC에서는 localStorage 저장을 권장하지 않습니다.

---

## Notes (Cloudflare Pages)

- Functions 프록시(`functions/api-proxy/[[path]].ts`)가 Google API 요청을 중계하고, POST/PUT/PATCH의 JSON 본문에 포함된 `system_instruction`(또는 `systemInstruction`/`config.system_instruction`)에 숨겨진 시스템 프롬프트를 자동 삽입합니다.
- 숨겨진 시스템 프롬프트는 `functions/constants.ts`에서 관리되며, 서버 사이드에서만 사용됩니다. 키/프롬프트는 로그에 평문으로 남지 않도록 주의합니다.

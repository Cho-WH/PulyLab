# 변경 기록: 사용자 API 키 입력 전환 / Cloudflare 전환

본 문서는 환경변수 기반(GEMINI_API_KEY/API_KEY)에서 "사용자 입력 API 키" 기반으로 전환한 변경사항을 요약합니다. 서버는 더 이상 환경변수 키를 사용하거나 저장하지 않으며, 브라우저에서 제공한 키만으로 프록시를 수행합니다.

## 개요
- 목적: ENV 의존 제거, 사용자 개인 키로 동작, 보안/투명성 강화
- 범위: 프런트엔드(UI/상태/SDK 초기화), 서버 프록시(HTTP/WS), 서비스워커/WS 인터셉터, 빌드 설정, 문서
- 브랜치: `feat/user-api-key-input`

## 추가 변경(Cloudflare Pages + Functions 대응)
- 정적 자산/주입 방식
  - `index.html`: 서비스워커 등록 스니펫과 `websocket-interceptor.js`를 정적으로 포함(주입 의존 제거)
  - 정적 파일 이관: `public/service-worker.js`, `public/websocket-interceptor.js`를 빌드 시 `dist/` 루트로 복사되도록 구성
- 엣지 프록시(Cloudflare Functions)
  - `functions/api-proxy/[...path].ts` 추가: HTTP 프록시 + WebSocket 업그레이드 처리
    - API 키 결정: 헤더 `X-Goog-Api-Key` 우선, 쿼리 `key`/`api_key` 보조(없으면 401)
    - HTTP: 쿼리의 키 파라미터 제거 후 업스트림에는 헤더로만 전달, 스트리밍 패스스루
    - WS: `/api-proxy/**` 업그레이드 시 쿼리의 `key` 필수, 상류(`wss://generativelanguage.googleapis.com/...`)와 양방향 중계
    - 로깅 하드닝: 키 값 미로그, 에러 사유 일반화
- 서버(로컬/호환성) 소폭 정리
  - `server/server.js`: 
    - index.html에 SW/WS가 이미 포함된 경우 주입 스킵
    - `/websocket-interceptor.js` 정적 라우트 추가(호환 경로)
    - 프록시 대상 URL 로그에서 `key=` 값 마스킹
- 문서
  - `README.md`: Cloudflare Pages + Functions 배포 가이드 섹션 추가
  - 새 문서 `docs/DEPLOY_CLOUDFLARE.md`: 초보자용 배포 절차 상세 작성
  - `AGENTS.md`: Cloudflare 전환 계획과 구현 범위 업데이트

## 주요 변경 요약
- 프런트엔드
  - 전역 키 상태: `context/ApiKeyContext.tsx`
  - 키 저장 유틸: `services/apiKeyStore.ts` (메모리 + 선택적 localStorage)
  - 키 입력 UI: `components/ApiKeyModal.tsx` (보기 토글, 로컬 저장 옵션, 간단 검증)
  - 앱 통합: `App.tsx`에 "키 설정" 버튼 및 키 미설정 시 흐름 차단
  - SDK 사용: `services/geminiService.ts`가 ENV 제거, 함수 인자로 `apiKey` 전달
  - 루트 진입: `index.tsx`가 `ApiKeyProvider`로 `App` 감싸기
- 서버
  - ENV 폴백 제거: `server/server.js`에서 `dotenv` 의존 및 ENV 키 사용 삭제
  - HTTP 프록시: `X-Goog-Api-Key` 헤더 또는 `?key=` 쿼리 필수. 없으면 401 반환
  - WS 프록시: `?key=` 쿼리 필수. 없으면 업그레이드 거부(1008)
  - 로그 하드닝: 키/URL 전체 노출 방지, 에러 메시지 일반화
  - HTML 주입: ENV 유무와 무관하게 SW/WS 스크립트 항상 주입
- 서비스워커/WS 인터셉터
  - `server/public/service-worker.js`: 프록시 로그에서 `key=` 값 마스킹
  - `server/public/websocket-interceptor.js`: 원본/프록시 URL 미노출(간결 로그)
- 빌드 설정
  - `vite.config.ts`: 빌드타임 `process.env.*` 주입 제거
- 문서
  - `README.md`: 사용자 키 입력 모델로 갱신, 배포/사용 안내 추가
  - `docs/DEPLOY_CLOUDFLARE.md`: Pages+Functions 배포 가이드 추가
  - `AGENTS.md`: 계획을 Cloudflare 전환 중심으로 교체

## 파일 변경 내역
- 추가
  - `services/apiKeyStore.ts`
  - `context/ApiKeyContext.tsx`
  - `components/ApiKeyModal.tsx`
  - 본 문서 `CHANGES.md`
- 수정
  - `services/geminiService.ts`: ENV 제거, `apiKey` 인자 사용, 시그니처 변경
  - `App.tsx`: 키 체크/모달 연동, 분석/채팅 호출부에 `apiKey` 전달
  - `index.tsx`: `ApiKeyProvider`로 래핑
  - `vite.config.ts`: ENV define 삭제
  - `server/server.js`: ENV 제거, 키 필수화(HTTP/WS), 로그 하드닝, 스크립트 항상 주입
  - `server/public/service-worker.js`: 로깅 마스킹, 헤더 전달 목록에 `X-Goog-Api-Key` 포함
  - `server/public/websocket-interceptor.js`: 과도한 URL 로그 제거
  - `README.md`: 사용자 키 입력 흐름으로 문서 갱신

## 동작 변화(이전 → 이후)
- 이전: 서버가 ENV의 API 키를 `X-Goog-Api-Key`/`key`에 강제 설정(프런트의 키 불필요)
- 이후: 클라이언트(브라우저)가 API 키를 제공해야 함. 없으면 프록시 거부(HTTP 401/WS 1008)

## 사용자 흐름
1) 앱 우측 하단 "키 설정" 클릭 → API 키 입력(옵션: 이 브라우저에 저장)
2) 문제 텍스트/이미지 업로드 → 분석 시작
3) HTTP/WS 요청은 프록시를 통해 전송되며, 키는 헤더/쿼리로 전달됨

## 보안/개인정보
- 키 저장: 기본 메모리 보관, 사용자가 동의 시 localStorage 저장
- 서버 저장: 없음(키는 요청마다 전달, 서버 로그에 키 문자열 미노출)
- 로깅: 서비스워커/서버에서 `key=` 값 마스킹, 에러 메시지 일반화

## 개발자 마이그레이션 가이드
- 함수 시그니처 변경
  - `analyzeProblem(problem, isProMode)` → `analyzeProblem(apiKey, problem, isProMode)`
  - `createChatSession(internalSolution)` → `createChatSession(apiKey, internalSolution)`
- 키 접근 방식
  - `process.env.*` 사용 금지. `useApiKey()`로 현재 키를 읽고 UI에서 설정
- 빌드/배포
  - Vite의 ENV define 제거. 서버에 ENV 키 주입 불필요
  - 프록시 엔드포인트: `/api-proxy/**` (방화벽/리버스프록시 허용 필요)

## 테스트 체크리스트
- [ ] 키 미설정 상태에서 분석 시도 → 모달/에러 안내 표시
- [ ] 올바른 키 입력 후 분석/채팅 정상 동작(스트리밍 포함)
- [ ] HTTP/WS 모두 사용자 키로 동작(쿼터/권한 오류 시 친절 메시지)
- [ ] 서버/서비스워커 로그에서 키 값 노출 없음(`REDACTED` 확인)
- [ ] `process.env` 의존 코드가 남아 있지 않음
 - [ ] Cloudflare 프리뷰/프로덕션에서 `/api-proxy/**` HTTP/WS 모두 정상 프록시
 - [ ] Functions 로그/브라우저 콘솔에 키 문자열 미노출

## 후속 개선(선택)
- 서버 패키지 정리: `dotenv` 의존성 제거(현재 미사용)
- 키 유효성 검증 고도화(형식/길이/접두어 등)
- 에러 메시지 i18n 및 가이드 링크 추가

---
본 변경은 AGENTS.md의 최신 계획(ENV 폴백 제거 포함)을 준수합니다. 추가 조정이 필요하면 본 문서를 업데이트하세요.

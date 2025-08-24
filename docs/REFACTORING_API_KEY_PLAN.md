# API 키 기반 흐름 리팩토링 계획

본 계획은 “키 먼저, 풀이 나중” 원칙에 따라 API 키 입력/검증/보안/SDK 사용 흐름을 명료하게 모듈화하고, 현재 발생 중인 오류의 근본 원인을 제거하기 위한 단계적 리팩토링 로드맵입니다.

## 목표와 원칙
- 키 먼저: 키가 유효하지 않으면 어떤 주요 기능도 시작되지 않음(온보딩 → 메인).
- 프라이버시: 키는 브라우저에만 저장(기본 세션 메모리, localStorage는 명시적 동의 시에만).
- 일관성: HTTP/WS 모두 동일한 키 전달 규칙을 사용하고, 모든 에러 메시지는 단일 매핑 함수에서 관리.
- 모듈화: 입력/검증/저장/SDK/가드시스템을 분리하여 각 책임을 명확히 함.
- 가시성: 상태머신(순환: unset → checking → valid/invalid), 검증 중/오프라인 상태가 UI에 반영.

## 현재 확인된 문제 요약
1) 게이트 오작동(핵심 버그): `App.tsx`의 `handleProblemSubmit`이 `useCallback([isProMode])`로 고정되어 `status/apiKey` 최신값을 참조하지 못함 → “풀이 시작하기” 즉시 ‘먼저 API 키…’ 오류.
2) 에러 메시지 일반화 과다: `getApiErrorMessage`가 SDK/프록시 에러 객체의 실제 구조를 충분히 커버하지 못해 Pro 분석 모드에서 4xx/네트워크 오류가 “알 수 없는 오류”로 표시됨.
3) 가드 분산: 온보딩/배지/배너/CTA 가드가 파일별로 흩어져 있고, 게이트 조건이 중복/불일치 가능.
4) 검증 로직 단일화 부족: 키 검증 API 호출/타임아웃/오프라인 처리/마스킹 로깅이 컴포넌트/컨텍스트/서비스에 분산.
5) HTTP/WS 경로 불투명성: SDK→서비스워커/WS 인터셉터→프록시 간 키 전달 규칙이 코드에 분산되어 추론 비용 증가.

## 목표 구조(모듈 설계)

### 1) 상태/저장(도메인 레이어)
- `context/ApiKeyContext.tsx`(정비)
  - 상태머신: `status: 'unset' | 'checking' | 'valid' | 'invalid'`
  - 노출: `apiKey`, `isValid`, `error`, `isPersisted`, `validateKey()`, `setApiKey()`, `clearApiKey()`
  - 내부: 동시 검증 취소(AbortController), 마지막 검증 시각, 오프라인 감지(선택)
- `services/apiKeyStore.ts`(정비)
  - 세션 메모리 기본, `persistKey()`로만 localStorage 접근
  - 포맷 검사 유틸 `isLikelyValidKey()` 유지/보강
  - 콘솔/로그 출력 시 키 마스킹 유틸(`maskKey()`) 사용
- [신규] `utils/security.ts`
  - `maskKey(key: string, visible: number = 4): string`
  - `sanitizeUrl(url: string): string` (쿼리의 `key` 값 마스킹)

### 2) 검증(Validation 레이어)
- [신규] `services/apiKeyValidation.ts`
  - `validateApiKey(apiKey, { signal, timeoutMs }): { ok: boolean; status: number; offline?: boolean }`
  - 동일 오리진 `/api-proxy/v1beta/models`에 `X-Goog-Api-Key`로 최소 GET/HEAD 호출
  - 0/타임아웃→오프라인 추정, 401/403→invalid, 2xx→valid, 그 외→임시 실패
  - 내부에서 키 평문 로깅 금지(마스킹)

### 3) SDK 어댑터(Integration 레이어)
- `services/geminiService.ts`(정비/단일 진입)
  - 모델 상수: `FLASH = 'gemini-2.5-flash'`, `PRO = 'gemini-2.5-pro'`
  - `analyzeProblem(apiKey, problem, { model }): Promise<string>`
  - `createChatSession(apiKey, internalSolution, { model = FLASH }): Chat`
  - 공통 에러 매핑: `mapApiError(err): FriendlyError`
  - 요청은 SDK를 그대로 사용하되, 서비스워커/WS 인터셉터가 동일 오리진 프록시로 라우팅
- [신규] `services/errors.ts`
  - `getApiErrorMessage(error: unknown): string`를 확장해 401/403/404/429/5xx/네트워크/타임아웃/JSON 오류 본문 패턴을 폭넓게 지원
  - SDK 예외(`e.cause`, `e.response?.status`, `e?.error?.code/status`), 프록시 JSON(`{ status, message, details }`) 모두 처리

### 4) UI 게이트/컴포넌트(프레젠테이션)
- `components/OnboardingKeyPanel.tsx`(유지): 풀스크린 최초 게이트
- `components/ApiKeyStatusBadge.tsx`/`components/ApiKeyBanner.tsx`(유지): 상시 상태 노출/행동 유도
- `components/CtaGuard.tsx`(유지): CTA 보호(툴팁 “먼저 API 키를 등록하세요”)
- `components/ApiKeyModal.tsx`(관리 전용으로 축소)
- [신규] `hooks/useRequireValidKey.ts`
  - 콜사이트에서 간단히 `requireValidKey(action)` 형태로 감싸 키 없을 때 온보딩 오픈/포커스 이동
- `App.tsx`(핵심):
  - 게이트는 단일 위치에서만 수행(상태가 `valid`가 아니면 온보딩 전면 표시)
  - 콜백/핸들러는 `status/apiKey` 최신값을 참조하도록 의존성/구조 보정

### 5) 서버/프록시/에셋(행동 변화 없음, 설정 명문화)
- Cloudflare Functions(`functions/api-proxy/**`)와 로컬 서버(`server/server.js`)는
  - HTTP: `X-Goog-Api-Key` 헤더를 상류로 전달, 쿼리의 `key`는 제거
  - WS: 브라우저가 헤더를 못 보내므로 쿼리 `key`를 허용(업스트림으로 전달)
  - 로그/에러 메시지는 키 마스킹, 사유 일반화
- `public/service-worker.js`, `public/websocket-interceptor.js`는 현행 유지하되, 로깅 최소화/키 마스킹 보장

## 단계별 실행 계획

### 0) 안정화 패치(핵심 버그 우선)
- App 게이트 콜백 최신화: `handleProblemSubmit`의 의존성에 `status`, `apiKey` 포함 또는 `useRequireValidKey`로 감싸기
- 실패 메시지 가시성 점검: `AppState.ANALYZING` 전환 조건/순서 검토
- DoD: “풀이 시작하기” 클릭 시 유효 키에서 스피너 표시, 무효/없음에서 온보딩 유도만 표시(즉시 에러 미표시)

### 1) 검증 흐름 단일화
- 신규 `services/apiKeyValidation.ts` 도입, `ApiKeyContext`에서 이 모듈만 호출
- 타임아웃/오프라인/중복 검증 취소(Abort) 기본 제공
- DoD: 오프라인에서 ‘검증 중…’→‘오프라인 안내’로 전이, 온라인 복귀 시 자동 재확인

### 2) 에러 메시지 표준화
- `services/errors.ts`로 `getApiErrorMessage`를 이관/확장
- 401/403: “키가 없거나 유효하지 않습니다”, 404: “요청 경로/모델을 확인하세요”, 429: “쿼터 초과”, 5xx/네트워크: “잠시 후 재시도”
- DoD: Pro 모드에서 모델/권한 오류 시, 일반화 문구 대신 정확한 안내로 표출

### 3) SDK 어댑터 정비
- `services/geminiService.ts` 정리: 모델 상수/시그니처/반환 타입 명확화, 내부에서만 SDK 인스턴스 생성
- 스트리밍(WS) 경로 확인: 쿼리 `key`가 SDK URL에 포함되는지 점검(미포함 시 인터셉터에서 추가하도록 개선)
- DoD: FLASH/PRO 모두 분석/채팅이 정상 스트리밍 작동, 요청 헤더/쿼리에 키가 누락되지 않음

### 4) UI 게이트 일원화
- `App.tsx`에서만 최초 게이트를 수행하고, 주요 CTA는 `CtaGuard`로 보호
- `ApiKeyModal`은 “관리 전용”(보기/교체/삭제)으로 축소, 온보딩 경로와 문구 일치
- 포커스/ARIA/aria-live 재검토(접근성), 모바일 풀스크린 레이아웃 확인
- DoD: 유효 키에서 메인 기능 즉시 접근 가능, 무효/누락 시 일관된 유도/차단 경험

### 5) 보안/프라이버시 하드닝
- 전역 마스킹 유틸 도입(`maskKey`) 후 콘솔/네트워크 로그에서 평문 금지 점검
- 로컬 저장은 명시적 opt‑in만 허용, clear 시 메모리/스토리지 모두 제거
- 서비스워커/프록시 로그도 마스킹 유지(이미 구현되어 있으나 회귀 테스트)
- DoD: 개발/배포 환경에서 키 문자열이 콘솔/로그/URL에 노출되지 않음

### 6) 개발/테스트 체계
- 간단한 핸드 시나리오 스크립트(문서) 갱신: 첫 방문/무효 키/오프라인/FLASH/PRO/WS 스트리밍
- 디버그 플래그(`DEBUG_API_KEY_FLOW`)로 상세 로그 on/off
- DoD: 시나리오 체크리스트 모두 통과, 디버그 off에서 민감 정보 노출 없음

## 파일/작업 매핑
- 신규: `services/apiKeyValidation.ts`, `services/errors.ts`, `utils/security.ts`, `hooks/useRequireValidKey.ts`
- 정비: `context/ApiKeyContext.tsx`, `services/apiKeyStore.ts`, `services/geminiService.ts`, `components/ApiKeyModal.tsx`, `components/CtaGuard.tsx`, `App.tsx`
- 유지(구성 확인): `public/service-worker.js`, `public/websocket-interceptor.js`, `functions/api-proxy/**`, `server/server.js`

## 마이그레이션 체크리스트
- [ ] App 게이트 콜백 최신화(핵심 버그 수정)
- [ ] 검증 모듈 도입 및 컨텍스트 연동
- [ ] 에러 메시지 매핑 확장 및 교체
- [ ] SDK 어댑터 정리 및 모델 상수화
- [ ] UI 게이트/관리 경로 일원화(온보딩 vs 모달)
- [ ] 로그 마스킹 전역 점검
- [ ] 수동 테스트 시나리오 통과

## 완료 기준(DoD)
- 키 미설정/무효에서 메인 기능 진입 차단, 온보딩에서만 진입
- 상단 배지/배너/CTA가 키 상태에 일관되게 반응
- Pro/Flash 모두 분석/대화 스트리밍 정상
- 401/403/404/429/5xx/네트워크에 대해 사용자 친화 메시지 표출
- 키는 브라우저에서만 저장되며 서버/로그에 노출되지 않음

## 롤백 전략
- 단계별 변경은 작은 커밋으로 나눔(0→6 순차). 문제가 생기면 바로 이전 단계로 롤백.
- 기능 플래그(`ENABLE_NEW_ERROR_MAPPING`, `ENABLE_VALIDATION_MODULE`)로 점진적 전환 가능.

---
문의/후속: 계획에 맞춰 구현 단계 착수 후, 0) 안정화 패치부터 적용합니다. 필요한 경우 추가 세부 계획(타임아웃/백오프 파라미터, 에러 샘플 매핑 표)을 본 문서에 보강하겠습니다.


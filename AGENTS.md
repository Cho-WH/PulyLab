# AGENTS 지침

- 언어는 한국어를 사용합니다.

## UX 중심 코드 변경 계획: “키 먼저, 풀이 나중”

목표: 첫 방문 시 API 키를 먼저 등록·검증한 뒤 문제 입력/풀이를 시작하도록 사용자 흐름을 재구성한다. 키 상태를 상시 노출하고, 키가 없거나 무효인 상태에서는 주요 작업을 일관되게 차단한다. 키는 브라우저에서만 관리되고 서버/로그에 저장되지 않는다.

### 사용자 흐름 개요
- 첫 방문: 풀스크린 온보딩(1단계: API 키 등록/검증 → 2단계: 문제 입력으로 이동).
- 재방문: 저장된 키가 유효하면 즉시 메인 진입, 상단에 “키 준비됨” 배지 표시. 미설정/무효면 상단 경고 배너 노출 + 주요 CTA 비활성화.
- 키 관리: 헤더 배지 클릭 또는 배너의 “키 등록/관리” 버튼으로 접근(보기/가리기, 교체, 삭제).

### 변경 대상 파일(정확 경로)
- `App.tsx`(변경): 키 상태 게이트(미설정/무효 시 온보딩 패널 전면 표시), 주요 뷰·CTA에 `ApiKeyGate` 적용.
- `context/ApiKeyContext.tsx`(변경): 상태머신 도입(`status: 'unset' | 'checking' | 'valid' | 'invalid'`), `validateKey(apiKey)`/`setKey`/`clearKey`/`isPersisted` 제공.
- `services/apiKeyStore.ts`(변경): 세션 메모리 기본 + 선택적 localStorage, 키 마스킹 로깅, 간단한 형식 검사 유틸.
- `services/geminiService.ts`(변경): `getApiErrorMessage(status)` 보강(401/403 → 키 안내), 검증용 경량 호출 헬퍼 추가.
- `components/OnboardingKeyPanel.tsx`(신규): 풀스크린 온보딩(키 입력/보기 토글/저장 옵션/검증 진행/오류 표시/성공 이동). “무료 API 발급 가이드” 하이퍼링크 포함: [무료 API 발급 가이드](https://example.com).
- `components/ApiKeyStatusBadge.tsx`(신규): 헤더 우측 상태 배지(미설정/검증중/준비됨/오류) + 클릭 시 관리 패널 오픈.
- `components/ApiKeyBanner.tsx`(신규): 상단 고정 배너(미설정/오류 시) + “키 등록/관리” 버튼.
- `components/CtaGuard.tsx`(신규): `status!=='valid'`이면 children 비활성화 및 툴팁/클릭 시 온보딩 오픈.
- `components/ApiKeyModal.tsx`(변경/축소): 초기 게이트 용도에서 “관리 전용”으로 역할 축소 또는 제거(선택).
- `index.css`(변경): 풀스크린 온보딩/배너/배지의 기본 스타일.
- 서버/프록시/에셋: `functions/**`, `public/service-worker.js`, `public/websocket-interceptor.js`는 기능 변화 없음(현행 유지).

### 단계별 구현(무엇을 실제로 바꿀지)
1) 상태 모델 정리
   - `ApiKeyContext`에 `status`/`key`/`persist`/`error`/`validateKey` 추가.
   - 마운트 시 저장 키 로드 → 즉시 `validateKey()`로 상태 전이(`checking→valid/invalid`).

2) 온보딩 패널 도입(최초 게이트)
   - `OnboardingKeyPanel` 신설: 입력란, 보기 토글, “이 브라우저에 저장” 체크박스(기본 OFF), 진행 버튼.
   - 보안 안내 문구 포함: “키는 브라우저에만 저장되며 서버/로그에 남지 않습니다.”
   - 무료 발급 가이드 링크 추가: [무료 API 발급 가이드](https://example.com) (새 창, `rel="noopener noreferrer"`).
   - 제출 시 `validateKey()` 호출 → 로딩/성공/실패 상태 UI.

3) 전역 노출/가드
   - 헤더에 `ApiKeyStatusBadge` 추가, 클릭 시 키 관리 UI 열기.
   - `ApiKeyBanner`: `status==='unset'|'invalid'`에서 상단 고정 배너 노출.
   - 주요 CTA(“문제 풀이 시작”, 파일 업로드 등)에 `CtaGuard` 래핑.

4) 에러/메시지 보강
   - `getApiErrorMessage`: 401/403 → “키가 없거나 유효하지 않습니다”, 기타 5xx/네트워크 → 일반화 메시지.
   - 인라인 에러(잘못된 형식), 오프라인 시 지연 검증 안내.

5) 접근성/반응형
   - 온보딩/배너/배지에 키보드 포커스 순서/ARIA 레이블 적용, 에러는 `aria-live`로 공지.
   - 모바일에서 온보딩 풀스크린 레이아웃 최적화.

6) 최소 검증 호출 설계
   - `validateKey`: 동일 오리진 `/api-proxy/v1beta/models`에 `X-Goog-Api-Key`로 호출(응답 본문 무시, 상태코드만 사용). 실패 시 키 평문 로깅 금지.

7) 문구/국제화(선택)
   - 마이크로카피 상수화(`i18n/messages.ts` 등)로 재사용 및 테스트 용이성 확보.

### 컴포넌트 설계 요약
- `OnboardingKeyPanel`: Step 1(키 등록/검증) → 성공 시 패널 닫고 메인 입력으로 포커스 이동.
- `ApiKeyStatusBadge`: 색상/아이콘으로 상태 전달(미설정/검증중/준비됨/오류).
- `ApiKeyBanner`: 짧은 안내 + “키 등록/관리” 버튼.
- `CtaGuard`: 비활성화 상태에서 툴팁 “먼저 API 키를 등록하세요”.

### 상태/에러 처리 규칙
- 초기: `unset` → 사용자가 입력/저장 시 `checking` → 200 계열이면 `valid`, 401/403이면 `invalid`.
- 오프라인: `checking` 타임아웃 시 “오프라인 상태 — 온라인 시 자동 재확인”.
- 삭제/교체: 저장소와 메모리에서 모두 제거 후 `unset`으로 전이.

### 보안/프라이버시
- 기본 세션 메모리, 저장은 명시적 opt‑in(localStorage).
- 키/에러 로깅 시 평문 금지(마스킹), 네트워크 탭/콘솔 노출 방지.

### 테스트 시나리오(수동)
- 첫 방문: 온보딩 표시 → 키 등록/검증 성공 후 문제 입력 가능.
- 잘못된/누락 키: 401/403 → 배너/배지 상태와 CTA 비활성화 확인.
- 오프라인: 검증 실패 시 안내 유지, 온라인 전환 후 자동 재확인.

### 완료 기준(DoD)
- 키 미설정 상태에서 메인 기능이 시작되지 않고, 온보딩을 통해서만 진입.
- 상단 배지/배너와 CTA 가드가 키 상태에 일관되게 반응.
- 무료 API 발급 가이드 링크가 온보딩에 노출되고 동작(임시: https://example.com).
- 키는 브라우저에서만 저장되며 서버/로그에 노출되지 않음.

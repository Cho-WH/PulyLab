# AGENTS 지침

- 언어는 한국어를 사용합니다.

## 변경 계획: 환경변수 API 키 → 사용자 입력 키

목표: 현재 환경변수(`GEMINI_API_KEY`/`API_KEY`)에 의존하는 구조를 제거하고, 사용자가 자신의 Gemini API 키를 직접 입력·관리하도록 전환한다. 서버/클라이언트, HTTP/WS 흐름 모두 사용자 키를 활용하도록 안전하게 리팩터링한다. 코드는 이 계획에 따라 추후 커밋에서 수정한다(지금은 문서화만 수행).

### 현재 구조 파악(요약)
- 프런트엔드
  - `services/geminiService.ts`가 `process.env.API_KEY`로 SDK 인스턴스 생성. 미설정 시 즉시 throw.
  - `vite.config.ts`가 빌드 시 `process.env.API_KEY`/`GEMINI_API_KEY`를 주입.
  - 앱은 SDK가 호출하는 Google API로의 네트워크를 서비스워커(`server/public/service-worker.js`)와 WS 인터셉터(`server/public/websocket-interceptor.js`)가 `/api-proxy/**`로 리라이트.
- 서버(프록시)
  - `server/server.js`가 env에서 키를 읽어 HTTP 헤더(`X-Goog-Api-Key`) 및 WS 쿼리(`key=`)에 강제 설정. env 키 없으면 프록시 기능 비활성 경고 및 인젝션 스크립트 비삽입.

### 변경 원칙
- 사용자의 API 키는 브라우저에서 입력받고, 사용자의 선택 없이 서버에 저장/로깅하지 않는다.
- 가능한 한 기본값은 “세션 메모리 보관”, 사용자가 동의하면 “로컬 저장소 보관(localStorage)” 옵션 제공.
 - 서버 프록시는 “클라이언트 제공 키 필수”로 동작. 키는 절대 로그에 남기지 않는다. 키가 없으면 요청을 거부하고 프런트에 안내한다.
- 빌드타임 env 주입 제거. 런타임에 키 유무를 확인하고 UI로 안내.

### 변경 대상 파일
- 프런트엔드: `services/geminiService.ts`, `App.tsx`, `components/*`(API 키 입력 UI 추가), `vite.config.ts`
- 서버: `server/server.js`, `server/public/service-worker.js`, `server/public/websocket-interceptor.js`
- 문서: `README.md`

### 단계별 구현 계획
1) 키 관리 계층 신설
   - `src/services/apiKeyStore.ts`(신규):
     - 메모리 보관소: set/get/clear
     - 선택적 영속화: localStorage 사용(“이 브라우저에 저장” 토글)
     - 마스킹/유효성 검사 유틸(간단한 포맷 체크, 예: 영숫자/`-`/`_` 허용, 길이 제한)
   - React Context `ApiKeyProvider`(신규): 앱 전역에서 키 접근/갱신 가능하도록 제공.

2) 프런트엔드 SDK 초기화 방식 변경
   - `services/geminiService.ts`:
     - `process.env.API_KEY` 의존 제거 및 즉시 throw 삭제.
     - 함수형 API로 변경: `getGenAI(apiKey: string): GoogleGenAI` 또는 각 함수가 `apiKey`를 매개변수로 받도록 리팩터링.
     - `analyzeProblem`/`createChatSession`가 내부에서 `getGenAI(currentKey)` 사용.
   - 호출부(App): 현재 키가 없으면 분석/대화 시작 버튼 비활성화 및 키 입력 요구.

3) API 키 입력 UI 추가
   - 컴포넌트 `ApiKeyModal` 또는 상단 설정 패널(신규):
     - 입력 필드(type=password), 보기 토글, 붙여넣기 안내.
     - “이 브라우저에 저장” 체크박스(localStorage 동의).
     - 유효성 검사 및 저장/해제 버튼.
   - `App.tsx` 초기 렌더 시: 저장된 키 로드 → 없으면 업로드 화면 상단에 배너/모달로 키 입력 유도.

4) 프록시(서버) 동작을 “클라이언트 키 우선”으로 조정
   - HTTP(`/api-proxy/**`):
     - 키 결정 로직: (요청 헤더 `X-Goog-Api-Key`) → (요청 쿼리 `key`) 중 하나가 반드시 있어야 함.
     - 아웃바운드 요청 헤더 `X-Goog-Api-Key`는 클라이언트가 제공한 키로 설정. 입력한 키는 로그/에러에 노출 금지.
     - 키가 없으면 401/400 등 적절한 에러로 거부하고 프런트에서 재입력을 유도.
     - CORS/프리플라이트 경로 기존대로 유지.
   - WebSocket 업그레이드:
     - 현재 코드는 항상 env 키로 쿼리를 덮어씀. 이를 수정하여, 클라이언트 요청 URL 쿼리의 `key` 값만 사용.
     - 키가 없으면 업그레이드를 거부/종료(적절한 코드)하고 프런트에서 재입력을 유도.
     - 로깅 시 쿼리의 `key` 값은 마스킹 처리 또는 로그 제거.
   - 루트 경로(`/`) HTML 주입 로직:
     - 현재 “env 키가 없으면 스크립트 미삽입”인데, 사용자 키 흐름에서는 “항상” 서비스워커/WS 인터셉터를 주입하도록 변경.

5) 번들 타임 환경변수 주입 제거
   - `vite.config.ts`의 `define: { 'process.env.API_KEY': ..., 'process.env.GEMINI_API_KEY': ... }` 삭제.
   - 관련 코드가 빌드타임 변수에 의존하지 않도록 전면 런타임화.

6) 로깅/보안 하드닝
   - `server/public/service-worker.js`, `server/public/websocket-interceptor.js`의 URL/헤더 로깅에서 키가 노출될 수 있는 로그를 삭제 또는 마스킹.
   - `server/server.js`의 요청/응답 로깅에서 헤더/쿼리 중 `key`/`X-Goog-Api-Key`는 필터링.
   - 예외 메시지는 일반화(키 값 포함 금지).

7) UX/에러 처리
   - 키 미설정 시: 상단 경고 배너 + 설정/입력 모달 바로가기.
   - 키 포맷 오류/권한 오류/쿼터 초과 등: `getApiErrorMessage`에 “키 관련 오류” 분기 추가 및 한국어 친화 메시지.
   - 키 재설정/삭제 동선 제공(설정 패널에 “키 삭제” 버튼).

8) 문서 업데이트
   - `README.md`에 “사용자 API 키로 실행” 섹션 추가:
     - 어디서 키를 발급받는지, 저장 방식 옵션, 보안 주의사항(공용 PC에서 저장 비권장), 문제해결 항목.
     - 서버 프록시가 키를 저장하지 않으며, 로그에 남기지 않도록 설계되었음을 명시.

9) 테스트 계획(수동)
   - 프런트만(서버 env 미설정): 키 입력 → 문제 업로드 → 분석/채팅 정상 동작 확인.
   - 서버 env 설정 ON: 클라이언트 키 우선 적용 확인(의도적으로 잘못된 env + 올바른 클라 키 → 성공해야 함).
   - HTTP/WS 모두 사용자 키로 동작 확인(스트리밍/분석/오류 케이스).
   - 로깅 확인: 키 문자열이 어떤 로그에도 노출되지 않음.

10) 마이그레이션/호환성
   - ENV 키 폴백은 사용하지 않는다. 사용자 입력 키만 지원.

### 완료 기준(DoD)
- 빌드가 빌드타임 env 없이 성공하며, 키 미입력 시도에 친절히 안내.
- 사용자 키 입력 후, 분석/채팅이 HTTP/WS 전 구간에서 정상 동작.
- 서버/클라이언트/서비스워커/WS 인터셉터 어디에도 키가 로그로 노출되지 않음.
- README에 새 흐름이 반영됨.

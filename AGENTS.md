# AGENTS 지침 (작업 계획)

- 언어는 한국어를 사용합니다.

## 목표
- `user-api` 브랜치를 `main`과 최대한 동일한 동작 흐름으로 단순화하되, “환경변수(API_KEY)” 대신 “사용자 입력 API 키”를 사용하도록 재구성합니다.
- Pro 토글의 의미를 `main`과 동일하게 유지합니다: 분석 모델에만 영향(`gemini-2.5-pro` vs `gemini-2.5-flash`), 채팅은 항상 `flash` 모델.
- 에러 메시지 체계(`services/errors.ts`)는 현행 유지(이미 잘 동작)하되, 호출·흐름을 `main`과 형식적으로 맞춥니다.

## 핵심 설계 원칙
- “서명(Signature)과 호출 위치”를 `main`과 동일하게: `geminiService.analyzeProblem(problem, isProMode)`, `geminiService.createChatSession(internalSolution)`.
- “키 전달”만 내부화: 서비스는 `ApiKeyContext`가 유지하는 “메모리 키(store)”를 읽어 SDK 인스턴스를 생성. 컴포넌트/호출부에서 키 인자를 넘기지 않음.
- “요청 형태”를 `main`과 동일하게: `models.generateContent({ model, contents: { parts } })` 형식(배열+role 사용하지 않음)으로 회귀.

## 변경 범위(파일별)
- `services/geminiService.ts`
  - 시그니처 변경: `analyzeProblem(problem, isProMode)`, `createChatSession(internalSolution)`로 통일.
  - 내부 구현만 사용자 키를 사용: `getMemoryKey()`로 현재 키를 확보 → `new GoogleGenAI({ apiKey })` 생성 후 사용.
  - 요청 본문은 `main`과 동일한 `contents: { parts }` 형태로 정렬.
  - 시스템 프롬프트 삽입은 프록시가 담당하므로 여기서는 `main`과 동일하게 유지.

- `App.tsx`
  - `analyzeProblem(apiKey, problem, isProMode)` → `analyzeProblem(problem, isProMode)`로 변경.
  - `createChatSession(apiKey, solution)` → `createChatSession(solution)`로 변경.
  - 에러 메시지는 현행처럼 `services/errors.getApiErrorMessage` 사용 유지(또는 `main`과 동일 import 경로로 얕은 정렬 가능).
  - 나머지 흐름(첫 메시지 스트리밍·상태전이)은 `main`과 코드 수준으로 동일하게 맞춤.

- `context/ApiKeyContext.tsx` / `services/apiKeyStore.ts`
  - 현재 동작 유지. 키 변경 시 `setMemoryKey`로 메모리 스토어 갱신하는 기존 로직 활용.
  - 별도 서비스 레이어에서 키를 인자로 받지 않도록 일관성 확인.

- 프록시/인터셉터(`functions/api-proxy/**`, `public/service-worker.js`, `public/websocket-interceptor.js`)
  - 변경 없음. 현 구조를 그대로 사용(요청은 브라우저→동일 오리진 프록시로 흐름).

## 구현 단계(체크리스트)
1) 동기화 대상 확인
   - `main`의 `services/geminiService.ts` 구조(시그니처·모델 선택·chat 생성·첫 메시지 흐름) 재검토.
   - `user-api`의 서비스/앱 시그니처 차이와 호출부 위치 차이를 명확화.

2) 서비스 시그니처 정렬
   - `services/geminiService.ts`에서 apiKey 인자를 제거하고, `getMemoryKey()`를 통해 키를 주입.
   - `analyzeProblem(problem, isProMode)`에서 모델 선택 로직을 `main`과 동일 구현.
   - `createChatSession(internalSolution)`에서 채팅 모델은 항상 `gemini-2.5-flash` 고정.

3) 요청 본문 정렬
   - `models.generateContent` 호출 시 `contents: { parts }`로 `main`과 동일하게 변경.
   - 이미지 파트 포함 로직은 `main`과 동일하게 유지.

4) App 호출부 정렬
   - `App.tsx`에서 서비스 호출부의 인자 제거 및 import 정리.
   - 첫 메시지 트리거/스트리밍/상태 전이 코드를 `main`과 동일하게 유지.

5) Pro 토글 확인
   - `ProblemUploader.tsx` 토글 → `App.tsx`의 `isProMode` → `analyzeProblem(..., isProMode)` 전파 경로 검증.
   - 채팅은 항상 `flash`로 생성되는지 확인.

6) 에러 메시지 경로 확인
   - `catch`에서 `services/errors.getApiErrorMessage` 사용 유지(현행 매핑 신뢰).
   - 필요 시 `main`의 메시지를 보조적으로 참고하되, 중복 함수는 유지하지 않음(단일 소스 사용).

7) 리스크/롤백
   - 타입 에러로 바로 검출 가능(서비스 시그니처 변경에 따른 컴파일 에러 기대).
   - 변경 파일은 `services/geminiService.ts`, `App.tsx` 중심이므로, 문제가 생기면 두 파일만 되돌리면 됨.

## 완료 기준(DoD)
- `App.tsx`와 `services/geminiService.ts`의 시그니처·흐름이 `main`과 동일(키 인자 제외)함을 코드 레벨로 확인.
- Pro 토글 ON 시 분석 모델만 `pro`로 전환, 채팅은 `flash` 고정.
- 사용자 키로 정상 분석→첫 메시지 생성→채팅 전환 흐름이 재현.
- 에러 발생 시 기존 `services/errors.ts`의 사용자 친화적 메시지가 그대로 출력됨.

## 검증 시나리오(수동)
- 키 등록(유효) 후 텍스트만 업로드: Flash/Pro 각각 분석 완료 → 첫 메시지 수신 및 채팅 전환.
- 이미지 포함 업로드: Flash/Pro 각각 동일 검증.
- 네트워크 오류/프록시 불가 상황: 기존 에러 매핑이 그대로 노출되는지 확인.

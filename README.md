# AI Studio Gemini App Proxy Server

This Node.js proxy enables running your AI Studio Gemini app without embedding secrets in code. In this setup, the browser supplies the user's Gemini API key per request; the server does not store or fallback to environment keys.


## Instructions

**Prerequisites**:
- [Google Cloud SDK / gcloud CLI](https://cloud.google.com/sdk/docs/install)
- Gemini API Key (입력은 브라우저에서 진행)

1. Download or copy the files of your AI Studio app into this directory at the root level.
2. Deploy to Cloud Run (no server-side API key needed):
    ```
    gcloud run deploy my-app --source=.
    ```

사용 방법:
- 앱 실행 후 우측 하단의 "키 설정" 버튼으로 Gemini API 키를 입력하세요.
- 원하면 "이 브라우저에 저장"을 선택하여 localStorage에 보관할 수 있습니다(서버에는 저장하지 않습니다).

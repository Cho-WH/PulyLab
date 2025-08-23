import React, { useState, useCallback, useRef } from 'react';
import type { Chat } from '@google/genai';
import { AppState, ChatMessage, ProblemInput } from './types';
import { analyzeProblem, createChatSession, getApiErrorMessage } from './services/geminiService';
import ProblemUploader from './components/ProblemUploader';
import ChatInterface from './components/ChatInterface';
import LoadingSpinner from './components/LoadingSpinner';
import ApiKeyModal from './components/ApiKeyModal';
import { useApiKey } from './context/ApiKeyContext';
import OnboardingKeyPanel from './components/OnboardingKeyPanel';
import ApiKeyStatusBadge from './components/ApiKeyStatusBadge';

function App() {
  const { apiKey, status } = useApiKey();
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [isProMode, setIsProMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<ProblemInput | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const [isKeyModalOpen, setKeyModalOpen] = useState(false);

  const resetState = () => {
    setAppState(AppState.UPLOAD);
    setError(null);
    setMessages([]);
    setIsResponding(false);
    chatSessionRef.current = null;
    setCurrentProblem(null);
    setIsProMode(false);
  };

  const handleProblemSubmit = useCallback(async (problem: ProblemInput) => {
    if (status !== 'valid' || !apiKey) {
      // 게이트: 키가 유효하지 않으면 진행하지 않음
      setError('먼저 API 키를 등록하세요.');
      setAppState(AppState.ERROR);
      return;
    }
    setCurrentProblem(problem);
    setAppState(AppState.ANALYZING);
    setError(null);
    try {
      // 1. Get only the internal solution from the analysis model.
      const solution = await analyzeProblem(apiKey, problem, isProMode);

      // 2. Create the chat session with the solution as its knowledge base.
      chatSessionRef.current = createChatSession(apiKey, solution);

      // 3. Have the chat model generate the opening message based on its system prompt.
      // This message is a programmatic trigger, not from the user.
      const stream = await chatSessionRef.current.sendMessageStream({ message: "학생과의 대화를 시작해주세요." });

      let openingMessage = '';
      for await (const chunk of stream) {
        openingMessage += chunk.text;
      }
      
      if (!openingMessage) {
        throw new Error("API로부터 첫 메시지를 받는 데 실패했습니다.");
      }
      
      // 4. Set the initial message and switch to the chat view.
      setMessages([{ role: 'model', content: openingMessage }]);
      setAppState(AppState.CHATTING);
    } catch (e) {
      const friendlyErrorMessage = getApiErrorMessage(e);
      setError(`문제 분석 및 대화 시작에 실패했습니다. ${friendlyErrorMessage}`);
      setAppState(AppState.ERROR);
    }
  }, [isProMode]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!chatSessionRef.current) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setIsResponding(true);

    try {
      const stream = await chatSessionRef.current.sendMessageStream({ message: messageText });

      let modelResponse = '';
      let firstChunk = true;

      for await (const chunk of stream) {
        modelResponse += chunk.text;
        if (firstChunk) {
          // As soon as the first chunk arrives, add it as a new message
          // and turn off the generic "responding" indicator.
          setIsResponding(false);
          setMessages(prev => [...prev, { role: 'model', content: modelResponse }]);
          firstChunk = false;
        } else {
          // For subsequent chunks, update the last message.
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = modelResponse;
            return newMessages;
          });
        }
      }

      if (firstChunk) {
        // This case handles an empty stream from the API.
        setIsResponding(false);
      }
    } catch (e) {
      const friendlyErrorMessage = getApiErrorMessage(e);
      setMessages(prev => [...prev, { role: 'model', content: `죄송합니다, 답변을 생성하는 중 오류가 발생했습니다: ${friendlyErrorMessage}` }]);
      setIsResponding(false);
    }
  }, []);

  const renderContent = () => {
    switch (appState) {
      case AppState.UPLOAD:
        return <ProblemUploader onProblemSubmit={handleProblemSubmit} isAnalyzing={false} isProMode={isProMode} onProModeChange={setIsProMode} />;
      case AppState.ANALYZING:
        return (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl shadow-lg">
            <LoadingSpinner className="w-16 h-16" />
            <h2 className="mt-6 text-2xl font-bold text-gray-800">AI 튜터가 문제를 분석하고 있어요...</h2>
            <p className="mt-2 text-gray-600">최적의 학습 경로를 설계하는 중입니다. 잠시만 기다려주세요.</p>
          </div>
        );
      case AppState.CHATTING:
        return <ChatInterface messages={messages} onSendMessage={handleSendMessage} isResponding={isResponding} onReset={resetState} problem={currentProblem} />;
      case AppState.ERROR:
        return (
            <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-red-200">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600">오류 발생</h2>
                    <p className="text-gray-700 mt-4">{error}</p>
                    <button onClick={resetState} className="mt-6 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        다시 시도하기
                    </button>
                </div>
            </div>
        );
      default:
        return null;
    }
  };

  // 키가 유효하지 않으면 온보딩 패널을 전면 표시
  if (status !== 'valid') {
    return (
      <main className="bg-gray-100 w-full min-h-screen">
        <OnboardingKeyPanel />
        <ApiKeyStatusBadge onManage={() => setKeyModalOpen(true)} />
        <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setKeyModalOpen(false)} />
      </main>
    );
  }

  return (
    <main className={`bg-gray-100 w-full min-h-screen flex justify-center p-4 ${appState === AppState.CHATTING ? 'items-start' : 'items-center'}`}>
      <ApiKeyStatusBadge onManage={() => setKeyModalOpen(true)} />
      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setKeyModalOpen(false)} />
      {renderContent()}
    </main>
  );
}

export default App;

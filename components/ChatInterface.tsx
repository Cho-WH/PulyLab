import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ChatMessage, ProblemInput } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Icon from './Icon';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isResponding: boolean;
  onReset: () => void;
  problem: ProblemInput | null;
}

const ICONS = {
    send: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5",
    chevronUp: "M4.5 15.75l7.5-7.5 7.5 7.5",
    chevronDown: "M19.5 8.25l-7.5 7.5-7.5-7.5"
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isResponding, onReset, problem }) => {
  const [input, setInput] = useState('');
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isResponding]);

  const handleSend = () => {
    if (input.trim() && !isResponding) {
      onSendMessage(input.trim());
      setInput('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };


  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col bg-white shadow-2xl rounded-2xl border border-gray-200 my-4">
      <header className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800">AI 과학 튜터</h1>
        <button 
          onClick={onReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors"
        >
          새 문제 풀기
        </button>
      </header>
      
      <div 
        className="p-3 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors flex justify-between items-center flex-shrink-0"
        onClick={() => setIsProblemVisible(!isProblemVisible)}
        role="button"
        aria-expanded={isProblemVisible}
        aria-controls="problem-display"
      >
        <h2 className="text-md font-semibold text-gray-700">현재 문제</h2>
        <Icon path={isProblemVisible ? ICONS.chevronUp : ICONS.chevronDown} className="w-5 h-5 text-gray-600"/>
      </div>

      {isProblemVisible && problem && (
          <div id="problem-display" className="p-4 border-b border-gray-200 bg-gray-100">
              {problem.text && (
                  <div className="mb-2">
                    <h3 className="font-semibold text-gray-600 mb-1">문제 내용:</h3>
                    <div className="prose prose-sm max-w-none text-gray-800 bg-white p-3 rounded-md border">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {problem.text}
                        </ReactMarkdown>
                    </div>
                  </div>
              )}
              {problem.image && (
                  <div className="mt-2">
                      <h3 className="font-semibold text-gray-600 mb-2">첨부 이미지:</h3>
                      <img 
                          src={`data:${problem.image.mimeType};base64,${problem.image.data}`} 
                          alt="Submitted problem" 
                          className="max-w-full mx-auto rounded-md border p-1 bg-white"
                      />
                  </div>
              )}
          </div>
      )}
      
      <div className="p-6 bg-gray-50">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  AI
                </div>
              )}
              <div
                className={`max-w-md lg:max-w-lg px-5 py-3 rounded-2xl shadow-md ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                }`}
              >
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'text-gray-800'}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
              </div>
            </div>
          ))}
          {isResponding && (
             <div className="flex items-end gap-3 justify-start">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  AI
                </div>
                <div className="max-w-md lg:max-w-lg px-5 py-3 rounded-2xl shadow-md bg-white text-gray-800 rounded-bl-none border border-gray-200 flex items-center">
                    <LoadingSpinner className="w-5 h-5" />
                </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="궁금한 점을 질문해보세요..."
            rows={1}
            className="w-full p-3 pr-12 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            disabled={isResponding}
          />
          <button
            onClick={handleSend}
            disabled={isResponding || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            <Icon path={ICONS.send} className="w-5 h-5"/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
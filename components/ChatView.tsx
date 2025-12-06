import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createChatSession } from '../services/gemini';
import { ChatMessage, MessageRole } from '../types';
import { Chat, GenerateContentResponse } from "@google/genai";

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat session on mount
  useEffect(() => {
    chatSessionRef.current = createChatSession();
    
    // Add initial greeting
    setMessages([
      {
        id: 'init',
        role: MessageRole.MODEL,
        text: "Hello! I'm powered by Gemini 2.5 Flash. How can I help you today?",
        timestamp: Date.now()
      }
    ]);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClear = () => {
    setMessages([]);
    chatSessionRef.current = createChatSession();
    setMessages([
      {
        id: 'init-new',
        role: MessageRole.MODEL,
        text: "Chat cleared. What's next?",
        timestamp: Date.now()
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !chatSessionRef.current) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: MessageRole.USER,
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    const modelMsgId = (Date.now() + 1).toString();
    const newModelMsg: ChatMessage = {
      id: modelMsgId,
      role: MessageRole.MODEL,
      text: '', // Start empty
      timestamp: Date.now(),
      isStreaming: true
    };

    setMessages(prev => [...prev, newModelMsg]);

    try {
      const result = await chatSessionRef.current.sendMessageStream({ message: newUserMsg.text });
      
      let fullText = '';
      
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        const textChunk = c.text || '';
        fullText += textChunk;
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === modelMsgId 
              ? { ...msg, text: fullText }
              : msg
          )
        );
      }
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === modelMsgId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: MessageRole.MODEL,
          text: "I encountered an error processing your request. Please try again.",
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200">
            Chat Assistant
          </h1>
          <p className="text-slate-400 text-sm">Gemini 2.5 Flash</p>
        </div>
        <button
          onClick={handleClear}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
          title="Clear Chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto ${
              msg.role === MessageRole.USER ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === MessageRole.USER
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
              }`}
            >
              {msg.role === MessageRole.USER ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>

            <div
              className={`flex-1 min-w-0 rounded-2xl p-4 ${
                msg.role === MessageRole.USER
                  ? 'bg-blue-600/10 border border-blue-600/20 text-blue-50'
                  : 'bg-slate-800 border border-slate-700 text-slate-200'
              }`}
            >
              {msg.role === MessageRole.MODEL ? (
                 <div className="prose prose-invert prose-sm max-w-none">
                   <ReactMarkdown>{msg.text}</ReactMarkdown>
                   {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse align-middle"></span>}
                 </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Gemini anything..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none h-[52px] max-h-32 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">
          AI may display inaccurate info, including about people, so double-check its responses.
        </p>
      </div>
    </div>
  );
};
import React from 'react';
import { Content } from '@google/genai';

// Added enums for components/Navigation.tsx and components/ChatView.tsx
export enum AppView {
  CHAT = 'CHAT',
  IMAGE = 'IMAGE'
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  id?: string; // Added optional id
  role: "user" | "model";
  text: string;
  timestamp?: number; // Added optional timestamp
  isStreaming?: boolean; // Added optional isStreaming
  history?: string[]; // To store previous versions of a model's response
  isThinkingSummary?: boolean; // New: If true, this bubble represents AI thinking process
  thinkingProcess?: { // Details for the thinking process display
    durationMs: number | null; // null if still active
    steps: string[];
    currentStepIndex: number;
    isExpanded: boolean; // For the bubble's internal state
  };
  userPromptForRegeneration?: string; // New: Stores the user's prompt that led to this model response, for regeneration purposes.
}

export type AppState =
  | "AWAITING_PDF"
  | "PROCESSING_PDF"
  | "GENERATING_INDEX"
  | "PDF_READY"
  | "ERROR";

export interface LessonItem {
  title: string;
  topics: string[];
}

export interface IndexItem {
  unit: string;
  lessons: LessonItem[];
}

export const McqCategoryOptions = [
    'Definition Type',
    'True / False Type',
    'NOT Type',
    'EXCEPT Type',
    'All of the Above Type',
    'None of the Above Type',
    'Both A and B Type',
    'Statement Type (Single/Multiple)',
];

export interface McqOptions {
  language: 'English' | 'Urdu';
  count: number;
  mcqTypes: string[];
  tone?: string;
  instruction?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface QuizState {
  isActive: boolean;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  userAnswers: { question: string; answer: string; isCorrect: boolean }[];
  score: number;
  timeLimit: number; // Time limit per question in seconds
  timeRemaining: number; // Current remaining time for the question
  quizOptions?: McqOptions; // Added to store quiz generation options
}

export interface ResponseOptions {
    language: string;
    tone: string;
    length: string;
    lengthRange?: string;
    format: string[];
    customInstructions?: string;
}

export interface ChatResponseOptions {
  language: 'English' | 'Urdu';
  lengthType: 'Concise' | 'Detailed' | 'Deep Detailed';
  lengthValue: string; // e.g., "500 words" or "3 paragraphs", or just a number
  tone: string; // e.g., 'Polite', 'Formal'
  format: string[]; // multi-select: 'Paragraphs', 'Bullet Points', 'Numbering', 'Keypoints', 'Table'
  instruction: string; // User's custom instruction for this specific response
}

export type ChatModalContext = {
  type: 'generate' | 'regenerate';
  userPrompt: string; // The base prompt from user input or previous user message
  messageIndex?: number; // Only for 'regenerate' type, to identify which message to update
};

export type ThreadType = 'summary' | 'quiz' | 'lecture' | 'questions' | 'mcqs' | 'chatbot';

export const ThreadTypeTitles: Record<ThreadType, string> = {
    summary: 'Summary',
    quiz: 'Quiz Session',
    lecture: 'Lecture Notes',
    questions: 'Generated Questions',
    mcqs: 'Generated MCQs',
    chatbot: 'Acrobat Copilot',
};

export interface ChatThread {
    id: string;
    title?: string;
    type: ThreadType;
    createdAt: number;
    chatHistory: Content[];
    chatMessages: ChatMessage[];
    topicSelection?: { title: string; subheading?: string };
}

// New Session interface for chat history management
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  fileName: string;
  fileSize: number;
  numPages: number | undefined;
  fileText: string;
  threads: ChatThread[];
  activeThreadId: string | null;
  indexData: IndexItem[];
}


export const ToneOptions = ['Casual', 'Formal', 'Professional', 'Polite', 'Simple', 'Poetic'];
export const FormatOptions = ['Paragraphs', 'Bullet Points', 'Numbering', 'Keypoints', 'Table'];
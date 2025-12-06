import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { AppState, ChatMessage, IndexItem, McqOptions, QuizQuestion, QuizState, ChatResponseOptions, ChatModalContext, ToneOptions, FormatOptions, Session, ThreadType, ChatThread, ThreadTypeTitles, McqCategoryOptions } from './types';
import { extractTextFromFile } from './services/pdfService';
import { getInitialHistory, sendMessageStream, generateDocumentIndex, generateQuizQuestionsFromText } from './services/geminiService';

// FIX: To augment the global Window interface within a module, it must be
// wrapped in a `declare global` block. This makes the SpeechRecognition
// properties available on `window` and resolve the TypeScript errors.
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Helper to format file size
const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


// --- Helper Components & Icons ---

const BookIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 3C10.343 3 9 4.343 9 6V10C9 11.657 10.343 13 12 13C13.657 13 15 11.657 15 10V6C15 4.343 13.657 3 12 3ZM19 10H17V11C17 13.761 14.761 16 12 16C9.239 16 7 13.761 7 11V10H5V11C5 14.561 7.71 17.439 11 17.918V21H9V23H15V21H13V17.918C16.29 17.439 19 14.561 19 11V10Z" />
    </svg>
);

const BackIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
);

const NewChatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const ChatbotIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" strokeWidth={1.5}>
    <path fill="#3b82f6" stroke="none" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
);


const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);

const RegenerateIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44 .84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
    </svg>
);

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.124-2.033-2.124H8.514C7.382 2.25 6.472 3.194 6.472 4.374v.916m7.5 0h-7.5" />
    </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

const MoreVertIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
);

const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

const AcademicCapIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const ExploreIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
);

const SummaryIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);

const QuestionListIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);

const McqIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

const QuizIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
    </svg>
);

const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 relative" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <TrashIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                </div>
                
                <p className="text-gray-600 dark:text-slate-300 mb-8 text-base leading-relaxed">
                    {message}
                </p>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2.5 text-gray-700 dark:text-slate-200 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium"
                    >
                        No, Keep It
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }} 
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-red-600/20"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const ShimmerLoader: React.FC = () => (
    <div className="w-full bg-gray-200 dark:bg-white/20 rounded-full h-3 my-8 shadow-inner overflow-hidden relative">
        <div className="h-3 rounded-full shimmer-loader"></div>
    </div>
);

const ProverbCarousel: React.FC = () => {
    const proverbs = [
        "Turning pages, turning data into dialogue.",
        "Every document has a story to tell. We're listening.",
        "From static text to dynamic conversation.",
        "Unlocking the knowledge within the pages."
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prevIndex) => (prevIndex + 1) % proverbs.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [proverbs.length]);

    return (
        <div className="text-center text-lg italic text-slate-300 h-8">
            <p className="animate-fade-in">{proverbs[index]}</p>
        </div>
    );
};

const ThinkingIndicator: React.FC = () => {
    const steps = [
        "Analyzing request...",
        "Scanning document content...",
        "Identifying key concepts...",
        "Structuring response...",
        "Drafting textbook-quality output...",
        "Finalizing formatting..."
    ];
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % steps.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-sm border border-blue-100 dark:border-slate-700 shadow-sm w-fit animate-fade-in">
             <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </div>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 animate-pulse min-w-[180px]">
                {steps[stepIndex]}
            </span>
        </div>
    );
};


const LandingPage: React.FC<{ 
    onFileSelect: () => void;
    onOpenHistory: () => void;
}> = ({ onFileSelect, onOpenHistory }) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in text-white relative p-4 overflow-y-auto" style={{
            backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.7), rgba(20, 20, 30, 0.7)), url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=2953&auto=format&fit=crop')",
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}>
            {/* Header with History Button */}
            <div className="absolute top-4 right-4 z-20">
                <button onClick={onOpenHistory} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 backdrop-blur-md rounded-lg text-sm font-medium transition-colors border border-white/10 text-slate-200">
                    <HistoryIcon className="w-4 h-4" /> History
                </button>
            </div>

            <div className="w-full max-w-xl text-center">
                 <BookIcon className="w-20 h-20 mx-auto text-white mb-4" />
                <h1 className="text-4xl font-bold text-white mb-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                    Adobe Acrobat
                </h1>
                <p className="text-slate-200 font-semibold mb-8 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] text-lg">
                    AI-powered document assistant. Upload PDF, Word, or TXT.
                </p>
                <button
                    onClick={onFileSelect}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg"
                >
                    Choose PDF
                </button>
            </div>
        </div>
    );
};

const ProcessingPage: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center text-white" style={{
        backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.7), rgba(20, 20, 30, 0.7)), url('https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=2756&auto-format&fit=crop')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    }}>
        <div className="text-center max-w-xl mx-4 animate-fade-in">
            <FileIcon className="w-20 h-20 mx-auto text-white mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">Analyzing your document...</h2>
            <p className="text-slate-300 mb-6 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">This may take a moment. Great insights are on their way!</p>
            <ShimmerLoader />
            <ProverbCarousel />
        </div>
    </div>
);

const GeneratingIndexPage: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center text-white relative" style={{
        backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.85), rgba(20, 20, 30, 0.85)), url('https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=2756&auto-format&fit=crop')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    }}>
        <div className="absolute inset-0 backdrop-blur-sm"></div>
        <div className="relative z-10 text-center max-w-xl mx-4 animate-fade-in bg-slate-900/50 p-8 rounded-xl shadow-lg border border-slate-700">
            <FileIcon className="w-16 h-16 mx-auto text-white mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">Preparing your document...</h2>
            <p className="text-slate-300 mb-6 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                Please wait while we generate an index for summaries, quizzes, and other features.
            </p>
            <ShimmerLoader />
        </div>
    </div>
);


const MenuPage: React.FC<{
    fileName: string;
    fileSize: string;
    numPages: number | undefined;
    onMenuAction: (action: ThreadType) => void;
    onNewDocument: () => void;
    onDeleteDocument: () => void;
    onOpenHistory: () => void;
}> = ({ fileName, fileSize, numPages, onMenuAction, onNewDocument, onDeleteDocument, onOpenHistory }) => (
    <div className="w-full h-full flex flex-col animate-fade-in text-white relative overflow-y-auto" style={{
        backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.85), rgba(20, 20, 30, 0.85)), url('https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=2756&auto-format&fit=crop')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
    }}>
        <header className="w-full p-4 flex justify-between items-center z-10 bg-slate-900/50 backdrop-blur-sm sticky top-0">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BookIcon className="w-8 h-8"/> Adobe Acrobat
            </h1>
            <div className="flex gap-2">
                <button onClick={onOpenHistory} className="bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold border border-slate-600">
                    <HistoryIcon className="w-4 h-4" /> History
                </button>
                <button onClick={onNewDocument} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold border border-blue-500">
                    <NewChatIcon className="w-4 h-4" /> New Doc
                </button>
            </div>
        </header>

        <main className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-6 flex-1 justify-center">
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Left: Doc Info */}
                <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                             <FileIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-lg truncate" title={fileName}>{fileName}</h3>
                            <p className="text-sm text-slate-400">{fileSize} • {numPages} Pages</p>
                        </div>
                    </div>
                     <button 
                        onClick={onDeleteDocument}
                        className="mt-auto w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                     >
                        <TrashIcon className="w-4 h-4" /> Delete Document
                    </button>
                </div>

                {/* Right: Actions Grid */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <button onClick={() => onMenuAction("lecture")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <ExploreIcon className="w-8 h-8 text-blue-400" />
                        <span className="font-semibold text-sm">Explore Content</span>
                    </button>
                    <button onClick={() => onMenuAction("summary")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <SummaryIcon className="w-8 h-8 text-green-400" />
                        <span className="font-semibold text-sm">Summary</span>
                    </button>
                    <button onClick={() => onMenuAction("chatbot")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <ChatbotIcon className="w-8 h-8 text-purple-400" />
                        <span className="font-semibold text-sm">Acrobat Copilot</span>
                    </button>
                    <button onClick={() => onMenuAction("questions")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <QuestionListIcon className="w-8 h-8 text-orange-400" />
                        <span className="font-semibold text-sm">Questions</span>
                    </button>
                    <button onClick={() => onMenuAction("mcqs")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <McqIcon className="w-8 h-8 text-teal-400" />
                        <span className="font-semibold text-sm">MCQs</span>
                    </button>
                    <button onClick={() => onMenuAction("quiz")} className="p-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105">
                        <QuizIcon className="w-8 h-8 text-red-400" />
                        <span className="font-semibold text-sm">Quiz</span>
                    </button>
                </div>
            </div>
        </main>
    </div>
);


const ChatBubble: React.FC<{
    message: ChatMessage;
    onRegenerate: (context: ChatModalContext, initialOptions?: ChatResponseOptions) => void; // Modified for modal
    onDelete: (messageIndex: number) => void;
    onExport: (messageIndex: number) => void;
    messageIndex: number;
}> = ({ message, onRegenerate, onDelete, onExport, messageIndex }) => {
    const isUser = message.role === 'user';
    const [isCopied, setIsCopied] = useState(false);

    const [versionIndex, setVersionIndex] = useState(0);
    const allVersions = [message.text, ...(message.history || [])];
    const currentTextToDisplay = allVersions[versionIndex];
    const hasHistory = allVersions.length > 1;

    // Urdu detection logic
    const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const isRtl = urduRegex.test(currentTextToDisplay);

    useEffect(() => {
        setVersionIndex(0);
    }, [message.text]);
    
    const handleVersionChange = (newIndex: number) => {
      if (newIndex >= 0 && newIndex < allVersions.length) {
        setVersionIndex(newIndex);
      }
    };

    const handleCopy = useCallback(() => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentTextToDisplay;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        navigator.clipboard.writeText(plainText).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => console.error("Failed to copy text:", err));
    }, [currentTextToDisplay]);
    
    const handleShare = useCallback(() => {
        if (navigator.share) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = currentTextToDisplay;
            const plainText = tempDiv.textContent || tempDiv.innerText || '';
            navigator.share({
                title: 'AI Chat Response',
                text: plainText,
            }).catch(error => console.error('Error sharing:', error));
        }
    }, [currentTextToDisplay]);
    
    const senderName = isUser ? 'You' : 'Adobe Acrobat Copilot';

    // Render logic for AI Thinking Summary Bubble
    if (message.isThinkingSummary) {
      return (
            <div className="flex w-full max-w-[90%] items-start gap-3 my-4">
                 <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    <ChatbotIcon className="w-5 h-5 text-black dark:text-white" />
                 </div>
                 <div className="flex flex-col flex-grow">
                    <span className="text-sm font-semibold mb-1 text-gray-700 dark:text-slate-300 flex items-center gap-2">
                        {senderName}
                    </span>
                    <ThinkingIndicator />
                </div>
            </div>
      );
    }


    // Default chat bubble rendering
    return (
        <div className={`flex flex-col group my-4 ${isUser ? 'items-end' : 'items-start'}`}>
             <div className={`flex w-full max-w-[90%] items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                 {!isUser && (
                     <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                        <ChatbotIcon className="w-5 h-5 text-black dark:text-white" />
                     </div>
                 )}
                 <div className="flex flex-col flex-grow">
                    <span className={`text-sm font-semibold mb-1 text-gray-700 dark:text-slate-300 ${isUser ? 'text-right' : 'flex items-center gap-2'}`}>
                        {senderName}
                    </span>
                    <div className={`relative p-4 rounded-2xl shadow-sm backdrop-blur-sm ${isUser 
                        ? 'bg-blue-500/50 dark:bg-blue-500/30 text-white rounded-br-none'
                        : 'bg-white/70 text-gray-800 rounded-bl-none dark:bg-slate-800/70 dark:text-slate-100'} ${isRtl ? 'text-right' : 'text-left'}`
                    }>
                        <div
                            dir={isRtl ? "rtl" : "auto"}
                            className={`prose prose-sm dark:prose-invert max-w-none 
                            prose-p:leading-relaxed prose-p:mb-4 
                            prose-headings:font-bold prose-headings:text-blue-600 dark:prose-headings:text-blue-400 prose-headings:mb-3 prose-headings:mt-6
                            prose-ul:my-4 prose-li:my-2 prose-ul:list-disc ${isRtl ? 'prose-ul:pr-5 prose-ul:pl-0' : 'prose-ul:pl-5'}
                            prose-ol:my-4 prose-ol:list-decimal ${isRtl ? 'prose-ol:pr-5 prose-ol:pl-0' : 'prose-ol:pl-5'}
                            prose-strong:font-bold prose-strong:text-gray-900 dark:prose-strong:text-white
                            prose-table:w-full prose-table:border-collapse prose-th:border prose-th:p-2 prose-td:border prose-td:p-2
                            overflow-x-auto`}
                            style={isRtl ? { fontFamily: "'Noto Naskh Arabic', 'Inter', sans-serif", lineHeight: '2.4', fontSize: '1.15rem', fontWeight: 500 } : {}}
                            dangerouslySetInnerHTML={{ __html: currentTextToDisplay }}
                        />
                    </div>

                    {hasHistory && (
                        <div className={`flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-slate-400 ${isUser ? 'justify-end' : ''}`}>
                            <button 
                                onClick={() => handleVersionChange(versionIndex + 1)} 
                                disabled={versionIndex >= allVersions.length - 1}
                                className="p-1 rounded-full hover:bg-gray-200/50 dark:hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Previous version"
                                title="Previous version"
                            >
                                <BackIcon className="w-4 h-4" />
                            </button>
                            <span>{versionIndex + 1} / {allVersions.length}</span>
                            <button 
                                onClick={() => handleVersionChange(versionIndex - 1)} 
                                disabled={versionIndex <= 0}
                                className="p-1 rounded-full hover:bg-gray-200/50 dark:hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Next version"
                                title="Next version"
                            >
                                <BackIcon className="w-4 h-4 transform rotate-180" />
                            </button>
                        </div>
                    )}

                    {/* Removed opacity-0 group-hover:opacity-100 to make actions always visible */}
                    <div className={`flex items-center mt-2 ${isUser ? 'justify-end' : ''}`}>
                        <div className="flex items-center gap-1 p-1 rounded-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-slate-700/50">
                            <button onClick={handleCopy} title="Copy" className="p-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-700 transition-colors">
                                {isCopied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5 text-gray-900 dark:text-gray-100" />}
                            </button>
                            {!isUser && message.userPromptForRegeneration && ( // Only show regenerate for model responses that had a user prompt
                                <button 
                                    onClick={() => onRegenerate({ type: 'regenerate', userPrompt: message.userPromptForRegeneration!, messageIndex: messageIndex })} 
                                    title="Regenerate with options" 
                                    className="p-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <RegenerateIcon className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                                </button>
                            )}
                            <button 
                                onClick={() => onExport(messageIndex)} 
                                title="Convert/Export" 
                                className="p-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-700 transition-colors"
                            >
                                <ExportIcon className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                            </button>
                            {typeof navigator.share === 'function' && (
                               <button onClick={handleShare} title="Share" className="p-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-700 transition-colors">
                                   <ShareIcon className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                               </button>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(messageIndex); }} 
                                title="Delete" 
                                className="p-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-700 transition-colors"
                            >
                                <TrashIcon className="w-5 h-5 text-red-500 dark:text-red-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Export Style Definitions
interface ExportStyleConfig {
  id: string;
  name: string;
  description: string;
  css: string;
  wordStyles: string;
}

const exportStyles: ExportStyleConfig[] = [
  {
    id: 'academic',
    name: 'Academic Report',
    description: 'Formal, Times New Roman, Justified',
    css: `
      font-family: 'Times New Roman', Times, serif; 
      line-height: 1.6; 
      text-align: justify;
    `,
    wordStyles: `font-family: 'Times New Roman', serif; line-height: 1.6; text-align: justify;`
  },
  {
    id: 'book',
    name: 'Book Style',
    description: 'Classic, Garamond, Immersive',
    css: `
      font-family: 'Georgia', 'Garamond', serif; 
      line-height: 1.5; 
      text-align: justify;
    `,
    wordStyles: `font-family: 'Georgia', serif; line-height: 1.5; text-align: justify;`
  },
  {
    id: 'report',
    name: 'Official Report',
    description: 'Corporate, Arial, Clean Headers',
    css: `
      font-family: 'Arial', 'Calibri', sans-serif; 
      line-height: 1.5; 
    `,
    wordStyles: `font-family: 'Arial', sans-serif; line-height: 1.5;`
  },
  {
    id: 'guide',
    name: 'Guidebook',
    description: 'Instructional, Verdana, Readable',
    css: `
      font-family: 'Verdana', 'Tahoma', sans-serif; 
      line-height: 1.6; 
    `,
    wordStyles: `font-family: 'Verdana', sans-serif; line-height: 1.6;`
  },
  {
    id: 'manual',
    name: 'Instruction Manual',
    description: 'Clear Steps, Segoe UI',
    css: `
      font-family: 'Segoe UI', 'Roboto', sans-serif; 
      line-height: 1.4; 
    `,
    wordStyles: `font-family: 'Segoe UI', sans-serif; line-height: 1.4;`
  },
  {
    id: 'ebook',
    name: 'E-Book / Story',
    description: 'Narrative Flow, Large Text',
    css: `
      font-family: 'Georgia', serif; 
      font-size: 14px;
      line-height: 1.8; 
    `,
    wordStyles: `font-family: 'Georgia', serif; font-size: 14pt; line-height: 1.8;`
  }
];


const ExportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[]; // Expects pre-filtered messages (full chat or single message)
    fileName: string;
    threadTitle: string;
}> = ({ isOpen, onClose, messages, fileName, threadTitle }) => {
    const [view, setView] = useState<'format' | 'style'>('format');
    const [selectedFormat, setSelectedFormat] = useState<'doc' | null>(null);

    // Reset view when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setView('format');
            setSelectedFormat(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFormatSelect = (format: 'txt' | 'doc') => {
        if (format === 'txt') {
            generateFile('txt'); // No style needed for TXT
        } else {
            setSelectedFormat(format);
            setView('style');
        }
    };

    const handleStyleSelect = (styleId: string) => {
        if (selectedFormat) {
            generateFile(selectedFormat, styleId);
        }
    };

    const generateFile = async (format: 'txt' | 'doc', styleId?: string) => {
        // Use messages prop directly; filtering logic is handled by the parent.
        const filteredMessages = messages; 
        
        const now = new Date();
        const readableTimestamp = now.toLocaleString();
        const filenameTimestamp = now.toISOString().replace(/:/g, '-').split('.')[0];
        const filenameBase = `chat-export-${filenameTimestamp}`;
        
        // Find selected style configuration
        const styleConfig = exportStyles.find(s => s.id === styleId) || exportStyles[0]; // Default to first if not found (shouldn't happen)

        const headerInfo = {
            doc: `Source Document: ${fileName}`,
            thread: `Topic: ${threadTitle}`,
            exportedAt: `Exported on: ${readableTimestamp}`
        };

        switch (format) {
            case 'txt': {
                const headerText = `${headerInfo.doc}\n${headerInfo.thread}\n${headerInfo.exportedAt}\n\n========================================\n\n`;
                const plainText = filteredMessages.map(msg => {
                    const prefix = msg.role === 'user' ? 'You' : 'Adobe Acrobat Copilot';
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = msg.text;
                    const content = tempDiv.textContent || tempDiv.innerText || '';
                    return `${prefix}:\n${content}`;
                }).join('\n\n---\n\n');

                const blob = new Blob([headerText + plainText], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filenameBase}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                break;
            }
            case 'doc': {
                const headerHtml = `
                    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background-color: #f8f9fa;">
                        <h2 style="margin: 0 0 10px 0;">${headerInfo.doc}</h2>
                        <p style="margin: 0;">${headerInfo.thread}</p>
                        <p style="margin: 0; font-size: 0.9em; color: #555;">${headerInfo.exportedAt}</p>
                    </div>
                `;
                
                // Wrap content in a div with the selected style's inline CSS
                const formattedHtml = filteredMessages.map(msg => {
                    const prefix = msg.role === 'user' ? 'You' : 'Adobe Acrobat Copilot';
                    return `
                        <p><strong>${prefix}:</strong></p>
                        <div style="${styleConfig.wordStyles}">
                            ${msg.text}
                        </div>
                    `;
                }).join('<br><hr style="border: 0; border-top: 1px solid #eee;"/><br>');

                const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
                    "xmlns:w='urn:schemas-microsoft-com:office:word' "+
                    "xmlns='http://www.w3.org/TR/REC-html40'>"+
                    "<head><meta charset='utf-8'><title>Chat History</title></head><body>";
                const footer = "</body></html>";
                const htmlContent = header + headerHtml + formattedHtml + footer;
                
                const blob = new Blob(['\ufeff', htmlContent], {
                    type: 'application/msword'
                });
                
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filenameBase}.doc`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                break;
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-center max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                
                {/* View 1: Format Selection */}
                {view === 'format' && (
                    <>
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Export Chat</h3>
                        <p className="text-gray-600 dark:text-slate-300 mb-6">Choose a format to convert your content.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => handleFormatSelect('txt')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105">
                                Export as Text (.txt)
                            </button>
                            <button onClick={() => handleFormatSelect('doc')} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105">
                                Export as Word (.doc)
                            </button>
                        </div>
                        <button onClick={onClose} className="mt-6 text-sm text-gray-500 dark:text-slate-400 hover:underline">
                            Cancel
                        </button>
                    </>
                )}

                {/* View 2: Style Selection */}
                {view === 'style' && (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select Style</h3>
                            <button onClick={() => setView('format')} className="text-sm text-blue-500 hover:underline">Back</button>
                        </div>
                        <p className="text-gray-600 dark:text-slate-300 mb-4 text-sm">Choose a visual style for your {selectedFormat?.toUpperCase()} document.</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {exportStyles.map((style) => (
                                <button 
                                    key={style.id}
                                    onClick={() => handleStyleSelect(style.id)}
                                    className="text-left p-4 rounded-lg border-2 border-gray-100 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all group"
                                >
                                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {style.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                        {style.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                        
                         <button onClick={onClose} className="mt-6 text-sm text-gray-500 dark:text-slate-400 hover:underline">
                            Cancel
                        </button>
                    </>
                )}

            </div>
        </div>
    );
};

const LectureModeSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: 'custom' | 'academic') => void;
}> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select Lecture Mode</h3>
                     <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
                         <XIcon className="w-6 h-6 text-gray-500 dark:text-slate-400" />
                     </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                        onClick={() => onSelect('custom')}
                        className="flex flex-col items-center p-6 rounded-xl border-2 border-transparent bg-blue-50 dark:bg-slate-700/50 hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-slate-700 transition-all group"
                    >
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-4 group-hover:scale-110 transition-transform text-blue-600 dark:text-blue-300">
                            <SettingsIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Custom Mode</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-300 text-center">
                            Configure language, tone, length, and formatting yourself.
                        </p>
                    </button>

                    <button 
                        onClick={() => onSelect('academic')}
                        className="flex flex-col items-center p-6 rounded-xl border-2 border-transparent bg-purple-50 dark:bg-slate-700/50 hover:border-purple-500 hover:bg-purple-100 dark:hover:bg-slate-700 transition-all group"
                    >
                         <div className="p-4 bg-purple-100 dark:bg-purple-900/50 rounded-full mb-4 group-hover:scale-110 transition-transform text-purple-600 dark:text-purple-300">
                            <AcademicCapIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Academic Mode</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-300 text-center">
                            Generate a structured, bilingual study guide with detailed elaborations.
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
};

const GenerationConfigModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (options: McqOptions) => void;
    threadType: ThreadType | null;
}> = ({ isOpen, onClose, onGenerate, threadType }) => {
    if (!isOpen) return null;

    const [options, setOptions] = useState<McqOptions>({
        language: 'English',
        count: threadType === 'questions' ? 10 : 5,
        mcqTypes: [],
        tone: 'Professional',
        instruction: ''
    });

    // Reset options when modal opens for a new thread type
    useEffect(() => {
        if (isOpen) {
            setOptions({
                language: 'English',
                count: threadType === 'questions' ? 10 : 5,
                mcqTypes: [],
                tone: 'Professional',
                instruction: ''
            });
        }
    }, [isOpen, threadType]);

    const handleMcqTypeToggle = (mcqType: string) => {
        setOptions(prev => ({
            ...prev,
            mcqTypes: prev.mcqTypes.includes(mcqType)
                ? prev.mcqTypes.filter(t => t !== mcqType)
                : [...prev.mcqTypes, mcqType]
        }));
    };
    
    const handleSelectAllMcqTypes = () => {
        if (options.mcqTypes.length === McqCategoryOptions.length) {
            setOptions(prev => ({ ...prev, mcqTypes: [] }));
        } else {
            setOptions(prev => ({ ...prev, mcqTypes: [...McqCategoryOptions] }));
        }
    };

    const isAllMcqsSelected = options.mcqTypes.length === McqCategoryOptions.length && McqCategoryOptions.length > 0;

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Configure {threadType === 'quiz' ? 'Quiz' : threadType === 'mcqs' ? 'MCQs' : 'Questions'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
                        <XIcon className="w-6 h-6 text-gray-500 dark:text-slate-400" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Language & Count */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Language</label>
                            <select
                                value={options.language}
                                onChange={e => setOptions({ ...options, language: e.target.value as 'English' | 'Urdu' })}
                                className="w-full p-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option>English</option>
                                <option>Urdu</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Count</label>
                            <input
                                type="number"
                                min="1"
                                max="200"
                                value={options.count}
                                onChange={e => setOptions({ ...options, count: parseInt(e.target.value, 10) || 1 })}
                                className="w-full p-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    {/* Tone (Questions/MCQs/Quiz) */}
                     <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Tone</label>
                        <select
                            value={options.tone}
                            onChange={e => setOptions({ ...options, tone: e.target.value })}
                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {ToneOptions.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>

                     {/* MCQ Types (MCQs/Quiz only) */}
                    {(threadType === 'mcqs' || threadType === 'quiz') && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">MCQ Types</label>
                            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-2 space-y-1 bg-white dark:bg-slate-700">
                                 <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors border-b border-gray-200 dark:border-slate-600 mb-1 sticky top-0 bg-white dark:bg-slate-700 z-10">
                                    <input
                                        type="checkbox"
                                        checked={isAllMcqsSelected}
                                        onChange={handleSelectAllMcqTypes}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800 dark:text-slate-200">Select All</span>
                                </label>
                                {McqCategoryOptions.map(cat => (
                                    <label key={cat} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={options.mcqTypes.includes(cat)}
                                            onChange={() => handleMcqTypeToggle(cat)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-800 dark:text-slate-200">{cat}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Instruction Box */}
                    <div>
                         <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Custom Instructions</label>
                         <textarea
                            value={options.instruction}
                            onChange={e => setOptions({ ...options, instruction: e.target.value })}
                            rows={4}
                            placeholder="Any specific topics or rules..."
                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                         />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-200 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium">
                        Cancel
                    </button>
                    <button 
                        onClick={() => onGenerate(options)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
}

const TopicSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selection: { title: string; subheading?: string } | null) => void;
    indexData: IndexItem[];
}> = ({ isOpen, onClose, onSelect, indexData }) => {
    if (!isOpen) return null;
    
    // Default to Overview as implied by "Table of Contents (one)" being listed first
    const [activeTab, setActiveTab] = useState<'overview' | 'detailed'>('overview');
    
    // Check if fallback index is present
    const isFallback = indexData.length === 1 && (indexData[0].unit.includes("Overview") || indexData[0].unit.includes("Partial"));

    useEffect(() => {
        if (isOpen) {
            setActiveTab('overview');
        }
    }, [isOpen]);

    const handleNodeClick = (node: { title: string, subheading?: string } | null) => {
        onSelect(node);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl m-4 flex flex-col h-[85vh] overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
                
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-center p-5 pb-2">
                         <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Table of Contents
                        </h3>
                         <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group">
                             <XIcon className="w-6 h-6 text-gray-500 dark:text-slate-400 group-hover:text-red-500 transition-colors" />
                         </button>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex px-5 gap-8 mt-2">
                        <button 
                            onClick={() => setActiveTab('overview')}
                            className={`pb-3 text-sm font-bold uppercase tracking-wide transition-all relative ${
                                activeTab === 'overview' 
                                ? 'text-blue-600 dark:text-blue-400' 
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Table of Contents Overview
                            {activeTab === 'overview' && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTab('detailed')}
                            className={`pb-3 text-sm font-bold uppercase tracking-wide transition-all relative ${
                                activeTab === 'detailed' 
                                ? 'text-blue-600 dark:text-blue-400' 
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Table of Contents Detailed
                            {activeTab === 'detailed' && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-6 custom-scrollbar">
                    {indexData.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-400 opacity-70">
                             <BookIcon className="w-12 h-12 mb-3" />
                             <p className="font-semibold text-lg">No table of contents found.</p>
                             <p className="text-sm">Try generating an index for this document again.</p>
                         </div>
                    ) : (
                        <div className="space-y-6">
                            {indexData.map((unitItem, uIndex) => (
                                <div key={uIndex} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                                    {/* Unit Header */}
                                    <div className="bg-gray-50/50 dark:bg-slate-800/50 p-4 border-b border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-lg text-gray-800 dark:text-slate-200">
                                            {unitItem.unit}
                                        </h4>
                                    </div>
                                    
                                    <div className="p-2">
                                        {unitItem.lessons.map((lesson, lIndex) => {
                                            const lessonNode = { title: `${unitItem.unit} - ${lesson.title}`, subheading: "Entire Lesson Content" };
                                            // Extract Lesson Number if present to bold it, or just display title
                                            const cleanedTitle = lesson.title; 
                                            // The user asked for "Lesson Number" and "Lesson Name". 
                                            // Usually "Lesson 1: Name" covers both.

                                            return (
                                                <div key={lIndex} className="mb-1 last:mb-0">
                                                    <div className="rounded-lg transition-all hover:bg-blue-50 dark:hover:bg-slate-700/40">
                                                        <button 
                                                            className={`w-full text-left p-3 flex items-start gap-3 group`}
                                                            onClick={() => handleNodeClick(lessonNode)}
                                                        >
                                                            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors ${activeTab === 'detailed' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600 group-hover:bg-blue-400'}`}></div>
                                                            <span className={`text-base font-medium leading-relaxed ${activeTab === 'detailed' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-300'}`}>
                                                                {cleanedTitle}
                                                            </span>
                                                        </button>

                                                        {/* Topics - ONLY in Detailed View */}
                                                        {activeTab === 'detailed' && lesson.topics && lesson.topics.length > 0 && (
                                                            <div className="ml-5 pl-4 border-l-2 border-gray-100 dark:border-slate-700 pb-2 space-y-1">
                                                                {lesson.topics.map((topic, tIndex) => {
                                                                    const topicNode = { title: `${unitItem.unit} - ${lesson.title}`, subheading: topic };
                                                                    // Check indentation depth based on numbering
                                                                    // e.g. 1.1 -> depth 0, 1.1.1 -> depth 1
                                                                    const parts = topic.split(' ')[0].split('.').filter(Boolean);
                                                                    const depth = Math.max(0, parts.length - 2); 
                                                                    
                                                                    return (
                                                                        <button 
                                                                            key={tIndex}
                                                                            className="w-full text-left py-1.5 px-3 rounded-md text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-300 transition-colors flex items-start"
                                                                            style={{ paddingLeft: `${depth * 12 + 12}px` }}
                                                                            onClick={() => handleNodeClick(topicNode)}
                                                                        >
                                                                            <span className="leading-snug">{topic}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer Actions */}
                <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shrink-0 flex justify-between items-center">
                    <div className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                        {isFallback ? "Auto-generated index structure" : `${indexData.length} Units Found`}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-semibold text-sm">
                            Cancel
                        </button>
                        <button 
                            onClick={() => handleNodeClick(null)} 
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20 text-sm flex items-center gap-2"
                        >
                            <BookIcon className="w-4 h-4" />
                            Use Full Document
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatResponseOptionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (options: ChatResponseOptions) => void;
    context: ChatModalContext | null;
    initialOptions: ChatResponseOptions | null;
}> = ({ isOpen, onClose, onGenerate, context, initialOptions }) => {
    const defaultOptions: ChatResponseOptions = {
        language: 'English',
        lengthType: 'Concise',
        lengthValue: '',
        tone: 'Casual',
        format: ['Paragraphs'],
        instruction: ''
    };

    const [options, setOptions] = useState<ChatResponseOptions>(initialOptions || defaultOptions);
    
    useEffect(() => {
        if (isOpen) {
            // When modal opens, initialize its state with provided initial options or defaults.
            setOptions(initialOptions || defaultOptions);
        }
    }, [isOpen, initialOptions]);

    if (!isOpen) return null;

    const handleFormatToggle = (format: string) => {
        setOptions(prev => ({
            ...prev,
            format: prev.format.includes(format)
                ? prev.format.filter(f => f !== format)
                : [...prev.format, format]
        }));
    };

    const handleGenerateClick = () => {
        // Here you can add validation if needed
        onGenerate(options);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl m-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{context?.type === 'regenerate' ? 'Regenerate Response' : 'Generate Response'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Language */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Language</label>
                        <select
                            value={options.language}
                            onChange={e => setOptions({ ...options, language: e.target.value as 'English' | 'Urdu' })}
                            className="w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            <option>English</option>
                            <option>Urdu</option>
                        </select>
                    </div>
                     {/* Tone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tone</label>
                        <select
                            value={options.tone}
                            onChange={e => setOptions({ ...options, tone: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {ToneOptions.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                     {/* Length */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Length</label>
                        <div className="flex gap-2">
                            <select
                                value={options.lengthType}
                                onChange={e => setOptions({ ...options, lengthType: e.target.value as 'Concise' | 'Detailed' | 'Deep Detailed' })}
                                className="p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                <option>Concise</option>
                                <option>Detailed</option>
                                <option>Deep Detailed</option>
                            </select>
                            <input
                                type="text"
                                placeholder="e.g., 500 words, 3 paragraphs"
                                value={options.lengthValue}
                                onChange={e => setOptions({ ...options, lengthValue: e.target.value })}
                                className="flex-grow p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    </div>
                     {/* Format */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Format</label>
                        <div className="flex flex-wrap gap-2">
                            {FormatOptions.map(f => (
                                <button
                                    key={f}
                                    onClick={() => handleFormatToggle(f)}
                                    className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${options.format.includes(f) 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 dark:bg-slate-600 dark:text-slate-200'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                     {/* Instruction Box */}
                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Instruction Box</label>
                         <textarea
                            value={options.instruction}
                            onChange={e => setOptions({ ...options, instruction: e.target.value })}
                            rows={3}
                            placeholder="Add any additional requirements for format, tune, etc."
                            className="w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                         />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-200 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleGenerateClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                        {context?.type === 'regenerate' ? 'Regenerate' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const QuizView: React.FC<{
    quizState: QuizState;
    onAnswer: (answer: string) => void;
    onNext: () => void;
    onRetake: () => void;
    onBackToMenu: () => void;
    onTimeUp: () => void;
}> = ({ quizState, onAnswer, onNext, onRetake, onBackToMenu, onTimeUp }) => {
    const { questions, currentQuestionIndex, userAnswers, score, timeLimit, timeRemaining } = quizState;
    const currentQuestion = questions[currentQuestionIndex];
    const isQuizFinished = currentQuestionIndex >= questions.length;
    // FIX: Changed NodeJS.Timeout to ReturnType<typeof setInterval> for browser compatibility.
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

    // Timer effect
    useEffect(() => {
        if (!isQuizFinished && quizState.isActive) {
            timerRef.current = setInterval(onTimeUp, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isQuizFinished, quizState.isActive, onTimeUp]);

    const timerPercentage = (timeRemaining / timeLimit) * 100;
    
    if (isQuizFinished) {
        const accuracy = (score / questions.length) * 100;
        return (
            <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in text-white p-4" style={{
                backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.85), rgba(20, 20, 30, 0.85)), url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2940&auto=format&fit=crop')",
                backgroundSize: 'cover', backgroundPosition: 'center'
            }}>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 max-w-2xl w-full text-center shadow-lg">
                    <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
                    <p className="text-xl mb-6">Your Score: <span className="font-bold text-green-400">{score}</span> out of <span className="font-bold">{questions.length}</span> ({accuracy.toFixed(1)}%)</p>
                    <div className="flex justify-center gap-4 mt-8">
                        <button onClick={onRetake} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">Retake Quiz</button>
                        <button onClick={onBackToMenu} className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors">Back to Menu</button>
                    </div>
                </div>
            </div>
        );
    }
    
    const userAnswerForCurrent = userAnswers.find(ua => ua.question === currentQuestion.question);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in text-white p-4" style={{
            backgroundImage: "linear-gradient(rgba(20, 20, 30, 0.85), rgba(20, 20, 30, 0.85)), url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=2953&auto=format&fit=crop')",
            backgroundSize: 'cover', backgroundPosition: 'center'
        }}>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 max-w-3xl w-full shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Question {currentQuestionIndex + 1} of {questions.length}</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-mono">{timeRemaining}s</span>
                        <div className="w-24 h-2 bg-slate-600 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 linear" style={{ width: `${timerPercentage}%` }}></div>
                        </div>
                    </div>
                </div>
                <p className="text-xl font-bold mb-6 min-h-[3em]">{currentQuestion.question}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => {
                        const isSelected = userAnswerForCurrent?.answer === option;
                        const isCorrect = currentQuestion.answer === option;
                        
                        let buttonClass = "p-4 text-left font-semibold rounded-lg transition-all border-2 border-transparent focus:outline-none focus:ring-4";
                        if (userAnswerForCurrent) { // An answer has been submitted
                             if (isCorrect) {
                                buttonClass += " bg-green-500/50 border-green-400";
                            } else if (isSelected) {
                                buttonClass += " bg-red-500/50 border-red-400";
                            } else {
                                buttonClass += " bg-slate-700/50 opacity-70";
                            }
                        } else { // No answer submitted yet
                            buttonClass += " bg-slate-700/50 hover:bg-slate-600/70 focus:ring-blue-500/50";
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => onAnswer(option)}
                                disabled={!!userAnswerForCurrent}
                                className={buttonClass}
                            >
                                <span className="font-bold mr-2">{labels[index] || (index + 1)}.</span>
                                {option}
                            </button>
                        );
                    })}
                </div>
                 {userAnswerForCurrent && (
                    <div className="flex justify-end mt-6">
                        <button onClick={onNext} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                           {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                 )}
            </div>
        </div>
    );
};

const HistorySidePanel: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    sessions: Session[],
    activeSessionId: string | null,
    onSelectSession: (sessionId: string) => void,
    onSelectThread: (threadId: string) => void,
    onDeleteSession: (sessionId: string) => void,
    onDeleteThread: (sessionId: string, threadId: string) => void,
    onUpdateThreadTitle: (threadId: string, newTitle: string) => void,
    onClearAllHistory: () => void,
}> = ({
    isOpen, onClose, sessions, activeSessionId, onSelectSession, onSelectThread,
    onDeleteSession, onDeleteThread, onUpdateThreadTitle, onClearAllHistory
}) => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
    const [editingThreadTitle, setEditingThreadTitle] = useState('');
    const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);

    const handleEditStart = (thread: ChatThread) => {
        setEditingThreadId(thread.id);
        setEditingThreadTitle(thread.title || ThreadTypeTitles[thread.type]);
    };

    const handleEditSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingThreadId && editingThreadTitle.trim()) {
            onUpdateThreadTitle(editingThreadId, editingThreadTitle.trim());
        }
        setEditingThreadId(null);
        setEditingThreadTitle('');
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 left-0 h-full w-full max-w-sm bg-gray-100 dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><HistoryIcon className="w-6 h-6"/> History</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
                            <XIcon className="w-6 h-6 text-gray-600 dark:text-slate-300"/>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {sessions.length === 0 ? (
                            <div className="text-center text-gray-500 dark:text-slate-400 mt-8">No history yet. Start a new chat!</div>
                        ) : (
                            sessions.map(session => (
                                <div key={session.id} className="bg-white dark:bg-slate-800/50 p-3 rounded-lg shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <button onClick={() => onSelectSession(session.id)} className="font-semibold text-left text-gray-800 dark:text-slate-200 hover:underline truncate flex-1">
                                            {session.fileName}
                                        </button>
                                        <button onClick={() => onDeleteSession(session.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title="Delete session">
                                            <TrashIcon className="w-4 h-4 text-red-500"/>
                                        </button>
                                    </div>
                                    <ul className="space-y-1 pl-2 border-l-2 border-gray-200 dark:border-slate-700">
                                        {session.threads.map(thread => (
                                            <li key={thread.id} className="group flex items-center justify-between">
                                                {editingThreadId === thread.id ? (
                                                    <form onSubmit={handleEditSave} className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={editingThreadTitle}
                                                            onChange={e => setEditingThreadTitle(e.target.value)}
                                                            onBlur={handleEditSave}
                                                            autoFocus
                                                            className="w-full bg-transparent text-sm p-1 rounded border border-blue-500"
                                                        />
                                                    </form>
                                                ) : (
                                                     <button 
                                                        onClick={() => onSelectThread(thread.id)} 
                                                        className={`text-sm text-left flex-1 p-1 rounded ${thread.id === activeSession?.activeThreadId ? 'bg-blue-100 dark:bg-blue-900/50 font-medium text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                                                    >
                                                        {thread.title || ThreadTypeTitles[thread.type]}
                                                    </button>
                                                )}
                                                
                                                <div className="relative flex-shrink-0">
                                                    <button onClick={() => setOpenMenuThreadId(openMenuThreadId === thread.id ? null : thread.id)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Options">
                                                        <MoreVertIcon className="w-5 h-5 text-gray-500 dark:text-slate-400"/>
                                                    </button>
                                                    {openMenuThreadId === thread.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-md shadow-lg z-30 border border-gray-200 dark:border-slate-700 py-1 animate-fade-in">
                                                            {thread.type === 'chatbot' && (
                                                                <button 
                                                                    onClick={() => { handleEditStart(thread); setOpenMenuThreadId(null); }} 
                                                                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                                                >
                                                                    <EditIcon className="w-4 h-4"/> Rename
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => { onDeleteThread(session.id, thread.id); setOpenMenuThreadId(null); }} 
                                                                className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                                                            >
                                                                <TrashIcon className="w-4 h-4"/> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>
                     {/* Footer */}
                     {sessions.length > 0 && (
                        <div className="p-4 border-t border-gray-200 dark:border-slate-800">
                            <button onClick={onClearAllHistory} className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 rounded-lg transition-colors">
                                <TrashIcon className="w-5 h-5"/> Clear All History
                            </button>
                        </div>
                     )}
                </div>
            </div>
        </>
    );
};


const ChatView: React.FC<{
    currentSession: Session;
    currentChatThread: ChatThread | undefined;
    isSending: boolean;
    onInitiateSend: (message: string) => void;
    onRegenerate: (context: ChatModalContext, options?: ChatResponseOptions) => void;
    onDeleteMessage: (messageIndex: number) => void;
    onDeleteCurrentThread: () => void;
    onStopGeneration: () => void;
    onBackToMenu: () => void;
    onNewThread: (type: ThreadType) => void;
    onOpenHistory: () => void;
}> = ({
    currentSession, currentChatThread, isSending, onInitiateSend, onRegenerate, onDeleteMessage, onDeleteCurrentThread, onStopGeneration, onBackToMenu, onNewThread,
    onOpenHistory
}) => {
    const [isListening, setIsListening] = useState(false);
    // Modified state to hold the messages to export directly
    const [exportModalData, setExportModalData] = useState<{ isOpen: boolean; messages: ChatMessage[] }>({ isOpen: false, messages: [] });
    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentChatThread?.chatMessages, isSending]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                 if (inputRef.current) {
                    inputRef.current.innerText = transcript;
                }
                setIsListening(false);
            };
            
            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };
    
    const handleSendClick = (e?: React.FormEvent) => {
        e?.preventDefault();
        const textToSend = inputRef.current?.innerText.trim();
        if (textToSend && !isSending) {
            onInitiateSend(textToSend);
            if (inputRef.current) inputRef.current.innerText = '';
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    // New export handlers
    const handleExportChat = () => {
        if (!currentChatThread) return;
        // Export full history (filtered)
        setExportModalData({
            isOpen: true,
            messages: currentChatThread.chatMessages.filter(msg => !msg.isThinkingSummary).slice(1)
        });
    };

    const handleExportSingleMessage = (index: number) => {
         if (!currentChatThread) return;
         // Export specific message. Note: index passed from bubble matches index in chatMessages array
         setExportModalData({
             isOpen: true,
             messages: [currentChatThread.chatMessages[index]]
         });
    };

    if (!currentChatThread) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400">
                No active chat. Select one from history or start a new one.
            </div>
        );
    }
    
    const { chatMessages } = currentChatThread;

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-slate-900 transition-colors">
            {/* Header */}
            <header className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={onBackToMenu} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Back to Menu">
                        <BackIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate" title={currentChatThread.title || ThreadTypeTitles[currentChatThread.type]}>
                            {currentChatThread.title || ThreadTypeTitles[currentChatThread.type]}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate" title={currentSession.fileName}>
                            {currentSession.fileName}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onOpenHistory} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-black dark:text-white" title="History">
                        <HistoryIcon className="w-6 h-6"/>
                    </button>
                     <div className="relative">
                         <button onClick={() => setShowOptionsDropdown(prev => !prev)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-black dark:text-white" title="More Options">
                            <MoreVertIcon className="w-6 h-6"/>
                        </button>
                        {showOptionsDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg z-20 border border-gray-200 dark:border-slate-700 animate-fade-in py-1">
                                <button onClick={() => { onNewThread('chatbot'); setShowOptionsDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"><NewChatIcon className="w-5 h-5"/> New Chat</button>
                                <button onClick={() => { handleExportChat(); setShowOptionsDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"><ExportIcon className="w-5 h-5"/> Export Chat</button>
                                <button onClick={() => { onDeleteCurrentThread(); setShowOptionsDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"><TrashIcon className="w-5 h-5"/> Delete Chat</button>
                            </div>
                        )}
                     </div>
                </div>
            </header>

            {/* Chat Messages */}
            <main className="flex-1 overflow-y-auto p-4 relative">
                <div className="max-w-4xl mx-auto">
                    {chatMessages.slice(1).map((msg, index) => ( // Slice to skip initial system prompt
                        <ChatBubble 
                            key={index} 
                            message={msg} 
                            messageIndex={index + 1} // Adjust index because we sliced(1)
                            onRegenerate={onRegenerate} 
                            onDelete={onDeleteMessage}
                            onExport={(idx) => handleExportSingleMessage(idx)}
                        />
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </main>

            {/* Footer / Input */}
            <footer className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-slate-700 relative">
                {isSending && (
                    <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in">
                            <button 
                            onClick={onStopGeneration}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-slate-800/90 dark:bg-slate-600/90 backdrop-blur-md rounded-full shadow-lg hover:bg-red-600 dark:hover:bg-red-600 transition-all border border-white/10 group"
                        >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 group-hover:bg-white"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 group-hover:bg-white"></span>
                            </span>
                            Stop Generating
                        </button>
                    </div>
                )}

                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 p-1 bg-gray-200/50 dark:bg-slate-700/50 rounded-2xl border border-gray-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                        <div className="relative flex-1">
                            {/* FIX: Replaced unsupported 'placeholder' on a div with 'data-placeholder' and used CSS pseudo-elements to show it. */}
                            <div
                                ref={inputRef}
                                contentEditable={!isSending}
                                onKeyDown={handleKeyDown}
                                data-placeholder="Type your message..."
                                className="w-full bg-transparent px-4 py-2 min-h-[40px] max-h-48 overflow-y-auto outline-none text-gray-900 dark:text-white empty:before:content-[attr(data-placeholder)] empty:before:absolute empty:before:left-4 empty:before:top-2 empty:before:text-gray-500 dark:empty:before:text-slate-400 empty:before:pointer-events-none"
                            />
                        </div>
                        {recognitionRef.current && (
                            <button onClick={toggleListening} disabled={isSending} className="p-2 rounded-full hover:bg-gray-300/50 dark:hover:bg-slate-600/50 disabled:opacity-50" title="Voice Input">
                                <MicrophoneIcon className={`w-6 h-6 ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-600 dark:text-slate-300'}`} />
                            </button>
                        )}
                        <button onClick={handleSendClick} disabled={isSending} className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 rounded-full text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </footer>
             <ExportModal 
                isOpen={exportModalData.isOpen} 
                onClose={() => setExportModalData({ isOpen: false, messages: [] })} 
                messages={exportModalData.messages} 
                fileName={currentSession.fileName}
                threadTitle={currentChatThread.title || ThreadTypeTitles[currentChatThread.type]}
            />
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>("AWAITING_PDF");
    const [sessions, setSessions] = useState<Session[]>(() => {
        try {
            const savedSessions = localStorage.getItem('chatSessions');
            return savedSessions ? JSON.parse(savedSessions) : [];
        } catch (e) {
            console.error("Failed to load sessions from localStorage", e);
            return [];
        }
    });
    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
        return localStorage.getItem('activeSessionId') || null;
    });
    const [activeSession, setActiveSession] = useState<Session | undefined>(undefined);
    const [activeThread, setActiveThread] = useState<ChatThread | undefined>(undefined);

    const [error, setError] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [quizState, setQuizState] = useState<QuizState | null>(null);

    // Modals State
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [isResponseOptionsModalOpen, setIsResponseOptionsModalOpen] = useState(false);
    const [isGenerationConfigModalOpen, setIsGenerationConfigModalOpen] = useState(false);
    const [isLectureModeModalOpen, setIsLectureModeModalOpen] = useState(false);
    const [responseOptionsContext, setResponseOptionsContext] = useState<ChatModalContext | null>(null);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

    // Confirmation Modal State
    const [confirmationModal, setConfirmationModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    // State for managing menu action flow
    const [pendingThreadType, setPendingThreadType] = useState<ThreadType | null>(null);
    // Used for storing topic if options modal is needed (now mainly for summary/lecture)
    const [pendingTopicSelection, setPendingTopicSelection] = useState<{ title: string; subheading?: string } | null>(null);
    const [autoGenerationTask, setAutoGenerationTask] = useState<{ type: ThreadType; prompt: string; topicSelection?: { title: string; subheading?: string; } } | null>(null);
    const [pendingGenerationDetails, setPendingGenerationDetails] = useState<{
        threadType: ThreadType;
        prompt: string;
        topicSelection?: { title: string; subheading?: string; };
    } | null>(null);

    const [lastChatResponseOptions, setLastChatResponseOptions] = useState<ChatResponseOptions | null>(() => {
        try {
            const saved = localStorage.getItem('lastChatResponseOptions');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isRequestCancelledRef = useRef(false);
    
    // Memoized values for performance
    useEffect(() => {
        const session = sessions.find(s => s.id === activeSessionId);
        setActiveSession(session);
        setActiveThread(session?.threads.find(t => t.id === session.activeThreadId));
    }, [sessions, activeSessionId]);

    // Effects for persistence
    useEffect(() => {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(sessions));
            if (activeSessionId) {
                localStorage.setItem('activeSessionId', activeSessionId);
            } else {
                localStorage.removeItem('activeSessionId');
            }
        } catch (e) {
            console.error("Failed to save sessions to localStorage", e);
        }
    }, [sessions, activeSessionId]);

    
    useEffect(() => {
        if (lastChatResponseOptions) {
            localStorage.setItem('lastChatResponseOptions', JSON.stringify(lastChatResponseOptions));
        }
    }, [lastChatResponseOptions]);

    // Effects for automatic content generation flow
    useEffect(() => {
        // Step 1: When a task is set, create the new thread for it.
        // This will trigger a re-render and update `activeThread`.
        if (autoGenerationTask) {
            startNewThread(autoGenerationTask.type, autoGenerationTask.topicSelection);
        }
    }, [autoGenerationTask]);

    useEffect(() => {
        // Step 2: After the thread is created and `activeThread` is updated,
        // send the prompt automatically.
        if (autoGenerationTask && activeThread?.type === autoGenerationTask.type && !isSending) {
            // We check if the thread is "new" (only has the default system message)
            // to avoid re-triggering on history navigation.
            if (activeThread.chatMessages.length === 1) {
                performSendMessage(autoGenerationTask.prompt, { type: 'generate', userPrompt: autoGenerationTask.prompt });
            }
            // The task has been initiated, so we clear it.
            setAutoGenerationTask(null);
        }
    }, [activeThread, isSending]); // This effect runs whenever activeThread changes.

    const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
        setConfirmationModal({ isOpen: true, title, message, onConfirm });
    };

    const closeConfirmation = () => {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
    };
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !/\.(pdf|docx|txt)$/i.test(file.name)) {
            setError("Please select a valid PDF, DOCX, or TXT file.");
            return;
        }

        setAppState("PROCESSING_PDF");
        setError('');

        try {
            const { text, numPages } = await extractTextFromFile(file);
            
            setAppState("GENERATING_INDEX");
            let indexData: IndexItem[] = [];
            try {
                indexData = await generateDocumentIndex(text);
            } catch (idxErr) {
                console.warn("Index generation failed, proceeding with default", idxErr);
                indexData = [{ unit: "Overview", lessons: [{ title: "Full Document Content", topics: ["Index generation failed. You can still chat with the full document."] }] }];
            }
            
            const newSession: Session = {
                id: `session_${Date.now()}`,
                title: file.name,
                createdAt: Date.now(),
                fileName: file.name,
                fileSize: file.size,
                numPages: numPages,
                fileText: text,
                threads: [],
                activeThreadId: null,
                indexData: indexData,
            };

            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
            setAppState("PDF_READY");
        } catch (err) {
            console.error("Error processing file:", err);
            const errorMessage = String(err);
            setError(errorMessage || "An unknown error occurred during processing.");
            setAppState("ERROR");
            setTimeout(() => setAppState('AWAITING_PDF'), 5000);
        }
    };

    const selectFile = () => {
        fileInputRef.current?.click();
    };
    
    const handleNewDocument = () => {
        selectFile();
    };
    
    const startNewThread = (type: ThreadType, topicSelection?: { title: string; subheading?: string }) => {
        if (!activeSession) return;
        
        const newThread: ChatThread = {
            id: `thread_${Date.now()}`,
            type: type,
            createdAt: Date.now(),
            chatHistory: getInitialHistory(activeSession.fileText),
            chatMessages: [{
                role: 'model',
                text: "Hello! How can I help you with this document today?"
            }],
            topicSelection: topicSelection
        };

        const updatedSession = {
            ...activeSession,
            threads: [...activeSession.threads, newThread],
            activeThreadId: newThread.id
        };
        
        setSessions(sessions.map(s => s.id === activeSessionId ? updatedSession : s));
    };
    
    const handleMenuAction = (action: ThreadType) => {
        if (['summary', 'lecture', 'mcqs', 'quiz', 'questions'].includes(action)) {
            setPendingThreadType(action);
            setIsTopicModalOpen(true);
        } else { // 'chatbot'
            startNewThread(action);
        }
    };
    
    const handleTopicSelectForThread = (selection: { title: string; subheading?:string} | null) => {
        if (!pendingThreadType) return;
        const action = pendingThreadType;

        setIsTopicModalOpen(false);
        setPendingTopicSelection(selection);

        if (action === 'lecture') {
             // For Lecture, we now show the Mode Selection Modal (Custom vs Academic)
            setIsLectureModeModalOpen(true);
        } else if (action === 'mcqs' || action === 'quiz' || action === 'questions') {
            // Open the Generation Config Modal
            setIsGenerationConfigModalOpen(true);
        } else {
             // For summary, go to Chat Response Options
            const topic = selection ? (selection.subheading || selection.title) : "the entire document";
            let prompt = "";
            if (action === 'summary') {
                prompt = `Please provide a **High Quality** detailed summary of the content related to "${topic}". Use <strong>Bold</strong> for key concepts and headings. Ensure proper line breaks between sections.`;
            }
            
            setPendingGenerationDetails({
                threadType: action,
                prompt: prompt,
                topicSelection: selection || undefined
            });
            setResponseOptionsContext({
                type: 'generate',
                userPrompt: prompt,
            });
            setIsResponseOptionsModalOpen(true);
        }
    };

    const handleLectureModeSelect = (mode: 'custom' | 'academic') => {
        setIsLectureModeModalOpen(false);
        const selection = pendingTopicSelection;

        // Determine scope and instructions based on what was clicked
        let topic = "the entire document";
        let scopeInstruction = "";

        if (selection) {
            if (selection.subheading === "Entire Lesson Content") {
                // User clicked the Lesson Title -> Wants full lesson, but ONLY that lesson
                topic = selection.title;
                scopeInstruction = `**CRITICAL INSTRUCTION**: Limit your response STRICTLY to the content of "${topic}". Do NOT include summaries of previous lessons, definitions from outside this lesson, or previews of upcoming lessons. Your lecture must cover every section within this specific lesson only.`;
            } else {
                // User clicked a specific sub-topic
                topic = selection.subheading || selection.title;
                scopeInstruction = `Focus specifically on the topic "${topic}" (found within the context of ${selection.title}).`;
            }
        }

        if (mode === 'custom') {
             const prompt = `Generate comprehensive, **lecturer-style notes** for: "${topic}". 
             ${scopeInstruction}
             Structure it with <strong>Bold Headings</strong>, key points, and explanations. Format it clearly with line breaks between sections.`;
             
             setPendingGenerationDetails({
                threadType: 'lecture',
                prompt: prompt,
                topicSelection: selection || undefined
            });
            setResponseOptionsContext({
                type: 'generate',
                userPrompt: prompt,
            });
            setIsResponseOptionsModalOpen(true);
        } else {
            // Academic Mode - Construct specialized prompt immediately
            const academicPrompt = `
            Act as an expert academic lecturer. Deliver a comprehensive lecture on "${topic}" using strict **Academic Mode** formatting.
            ${scopeInstruction}

            **Structure & Formatting Rules (Strict HTML):**

            1.  **Lesson Header**:
                <h3>Lesson: [Lesson Number & Name]</h3>

            2.  **Topics Overview**:
                <p><strong>Topics Covered:</strong></p>
                <ul>
                    <li>[Heading 1]</li>
                    <li>[Heading 2]</li>
                    <!-- List all headings found in this lesson -->
                </ul>
                <hr/>

            3.  **Content Breakdown (Iterate through every heading)**:
                
                <h4>Heading: [Heading Name]</h4>

                *For each section under this heading:*
                
                <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px; margin: 12px 0; border-radius: 0 4px 4px 0;">
                    <!-- CRITICAL: Check language of the quote. If English: text-align: left; direction: ltr. If Urdu: text-align: right; direction: rtl. -->
                    <!-- Also align the reference footer to match the text direction. -->
                    <p style="font-family: 'Times New Roman', serif; font-size: 1.1em; margin: 0; color: #1e293b; line-height: 1.6; text-align: [left/right]; direction: [ltr/rtl];">
                        "[Quote key lines from PDF]"
                    </p>
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-style: italic; text-align: [left/right]; direction: [ltr/rtl];">
                        📍 Ref: [Heading Name] | Page [Number]
                    </div>
                </div>

                <p><strong>ترجمہ:</strong> [Translate the quote to Urdu]</p>
                <p><strong>تفصیل:</strong> [Provide a DEEP, EXTENSIVE explanation of the concept in Urdu. Explain it as if teaching a master class. Use examples and analogies.]</p>
                <br/>

                *At the end of the heading section:*
                <div style="background-color: #eff6ff; padding: 10px; border-radius: 6px; margin: 10px 0; border: 1px solid #bfdbfe;">
                    <strong>خلاصہ:</strong> [Summarize the core concept of this heading in Urdu]
                </div>
                <hr/>

            4.  **Real Life Application**:
                <h3>Real Life Application</h3>
                <p>[Explain practical applications of these concepts in Urdu]</p>

            **IMPORTANT:** 
            - Use valid HTML tags.
            - Do NOT use Markdown.
            - **Original Text Handling:** Do NOT use words like "Original Text" or "Matn". Just show the quote.
            - **Language Alignment:** English quotes MUST start from the left. Urdu translation MUST start from the right.
            - **Reference Alignment:** The Reference Footer ("Ref: ...") inside the quote box MUST align to the SAME side as the quote text.
            - The "Detailed Elaboration" (Tafseel) is the most important part; make it very detailed.
            `;

            setAutoGenerationTask({
                type: 'lecture',
                prompt: academicPrompt,
                topicSelection: selection || undefined
            });

            setPendingThreadType(null);
            setPendingTopicSelection(null);
        }
    };

    const handleGenerateFromConfig = async (options: McqOptions) => {
        if (!activeSession || !pendingThreadType) return;
        
        // Close the config modal
        setIsGenerationConfigModalOpen(false);

        const selection = pendingTopicSelection;
        const actionType = pendingThreadType;
        const topic = selection ? (selection.subheading || selection.title) : "the entire document";

        if (actionType === 'quiz') {
            setAppState("GENERATING_INDEX"); // Show a loading state
            try {
                const mcqTypePrompt = options.mcqTypes.length > 0
                    ? `The questions should be of the following types: ${options.mcqTypes.join(", ")}.`
                    : '';
                let prompt = `Generate ${options.count} multiple-choice questions in ${options.language} based on the topic "${topic}" from the document provided. ${mcqTypePrompt} Each question should have 4 options and a single correct answer.`;
                
                // Incorporate Tone into the prompt for Quiz as well
                prompt += `\nTone: ${options.tone || 'Professional'}.`;

                if (options.instruction) {
                    prompt += `\nSpecial Instructions: ${options.instruction}`;
                }
                
                const questions = await generateQuizQuestionsFromText(activeSession.fileText, prompt);
                
                setQuizState({
                    isActive: true,
                    questions,
                    currentQuestionIndex: 0,
                    userAnswers: [],
                    score: 0,
                    timeLimit: 90, // seconds per question
                    timeRemaining: 90,
                    quizOptions: options,
                });
                startNewThread('quiz'); // Start a thread to represent this quiz session in history
                
            } catch(err) {
                setError(String(err));
            } finally {
                setAppState("PDF_READY");
                setPendingThreadType(null);
                setPendingTopicSelection(null);
            }
        } else if (actionType === 'mcqs' || actionType === 'questions') {
            const topicPrompt = `based on the topic "${topic}"`;
            
            let prompt = "";
            if (actionType === 'mcqs') {
                 const mcqTypePrompt = options.mcqTypes.length > 0
                    ? `The questions must be of the following types: ${options.mcqTypes.join(", ")}.`
                    : '';
                prompt = `Generate ${options.count} multiple-choice questions in ${options.language} ${topicPrompt}. ${mcqTypePrompt} 
    
                **Formatting Rules:**
                1. Use <strong>Bold</strong> for the Question Number and Text (e.g., <strong>1. What is...?</strong>).
                2. Label options clearly with A), B), C), D).
                3. Ensure a line break (Enter) separates the question from options, and options from the next question.
                4. Provide the correct Answer Key at the end.
                `;
            } else { // actionType === 'questions'
                prompt = `Generate ${options.count} thoughtful, open-ended questions in ${options.language} ${topicPrompt}. 
    
                **Formatting Rules:**
                1. Use <strong>Bold</strong> for the Question Number and Text.
                2. Ensure clear spacing (line breaks) between questions.
                `;
            }
            
            // Append new merged fields to prompt
            prompt += `\n\nTone: ${options.tone || 'Professional'}.`;
            if (options.instruction) {
                prompt += `\nSpecial Instructions: ${options.instruction}.`;
            }

            // Directly set the generation task
            setAutoGenerationTask({
                type: actionType,
                prompt: prompt,
                topicSelection: selection || undefined
            });

            setPendingThreadType(null);
            setPendingTopicSelection(null);
        }
    };
    
    const handleBackToMenu = () => {
        if(activeSession) {
             const updatedSession = { ...activeSession, activeThreadId: null };
             setSessions(sessions.map(s => s.id === activeSessionId ? updatedSession : s));
        }
        setQuizState(null);
    };
    
    const handleSendMessageWithOptions = (prompt: string, options: ChatResponseOptions) => {
      const { language, lengthType, lengthValue, tone, format, instruction } = options;
      
      let fullPrompt = `${prompt}\n\n---`;
      fullPrompt += `\nResponse Language: ${language}.`;
      
      let lengthDescription = lengthType;
      if (lengthValue) {
          lengthDescription += ` (${lengthValue})`;
      }
      fullPrompt += `\nLength: ${lengthDescription}.`;
      fullPrompt += `\nTone: ${tone}.`;
      fullPrompt += `\nFormat: ${format.join(', ')}.`;
      if (instruction) {
          fullPrompt += `\nSpecial Instructions: ${instruction}.`;
      }

      // IMPORTANT: Append strict formatting instruction here as well to ensure consistency
      fullPrompt += `\n\nIMPORTANT: Respond using ONLY valid HTML tags for formatting (e.g., <p>, <ul>, <li>, <strong>, <h3>). Do not use Markdown.`;
      
      return fullPrompt;
    };

    const performSendMessage = async (
      prompt: string,
      context: ChatModalContext,
      options?: ChatResponseOptions
    ) => {
        if (!activeSession || !activeThread) return;

        isRequestCancelledRef.current = false;
        const finalPrompt = options ? handleSendMessageWithOptions(prompt, options) : prompt;

        setIsSending(true);

        const userMessage: ChatMessage = { role: 'user', text: prompt };
        // We'll start with a thinking message, but we'll update it to a real message on first chunk
        const thinkingMessage: ChatMessage = { role: 'model', text: '', isThinkingSummary: true };
        
        const updatedMessages = [...activeThread.chatMessages, userMessage, thinkingMessage];
        
        const updatedThread = { ...activeThread, chatMessages: updatedMessages };
        setSessions(sessions.map(s => s.id === activeSessionId ? { ...s, threads: s.threads.map(t => t.id === s.activeThreadId ? updatedThread : t) } : s));

        try {
            let responseText = "";
            let isFirstChunk = true;

            for await (const chunk of sendMessageStream(activeThread.chatHistory, finalPrompt)) {
                if (isRequestCancelledRef.current) {
                    responseText += `<br/><br/><span class="text-red-500 text-xs italic font-bold block mt-2 border-t border-red-200 pt-1">(Generation stopped by user)</span>`;
                    break;
                }
                responseText += chunk;
                
                setSessions(prevSessions => {
                     return prevSessions.map(s => {
                        if (s.id !== activeSessionId) return s;
                        return {
                            ...s,
                            threads: s.threads.map(t => {
                                if (t.id !== s.activeThreadId) return t;

                                const currentMessages = [...t.chatMessages];
                                const lastMsgIndex = currentMessages.length - 1;
                                const lastMsg = currentMessages[lastMsgIndex];
                                
                                if (lastMsg.isThinkingSummary) {
                                     // Replace thinking message with normal model message on first update
                                     currentMessages[lastMsgIndex] = {
                                         role: 'model',
                                         text: responseText,
                                         userPromptForRegeneration: prompt,
                                         isThinkingSummary: false
                                     };
                                } else {
                                     // Update text
                                     currentMessages[lastMsgIndex] = {
                                         ...lastMsg,
                                         text: responseText
                                     };
                                }
                                return { ...t, chatMessages: currentMessages };
                            })
                        };
                    });
                });
                isFirstChunk = false;
            }
            
            // Final update to ensure history is consistent
            setSessions(prevSessions => {
                return prevSessions.map(s => {
                    if (s.id !== activeSessionId) return s;
                    return {
                        ...s,
                        threads: s.threads.map(t => {
                            if (t.id !== s.activeThreadId) return t;
                            return {
                                ...t,
                                chatHistory: [...t.chatHistory, { role: 'user', parts: [{ text: finalPrompt }] }, { role: 'model', parts: [{ text: responseText }] }],
                            };
                        })
                    };
                });
            });

        } catch (err) {
            const errorMessage: ChatMessage = { role: 'model', text: `<strong>Error:</strong> ${String(err)}` };
            setSessions(prevSessions => prevSessions.map(s => s.id === activeSessionId ? { ...s, threads: s.threads.map(t => t.id === s.activeThreadId ? { ...t, chatMessages: [...t.chatMessages.filter(m => !m.isThinkingSummary), errorMessage]} : t)} : s));
        } finally {
            setIsSending(false);
            isRequestCancelledRef.current = false;
        }
    };
    
    const performRegenerateMessage = async (
      prompt: string,
      messageIndex: number,
      options: ChatResponseOptions
    ) => {
        if (!activeSession || !activeThread) return;

        isRequestCancelledRef.current = false;
        const finalPrompt = handleSendMessageWithOptions(prompt, options);

        setIsSending(true);

        // Capture previous text for history
        const previousText = activeThread.chatMessages[messageIndex].text;

        try {
            let responseText = "";
            
            for await (const chunk of sendMessageStream(activeThread.chatHistory, finalPrompt)) {
                 if (isRequestCancelledRef.current) {
                    responseText += `<br/><br/><span class="text-red-500 text-xs italic font-bold block mt-2 border-t border-red-200 pt-1">(Generation stopped by user)</span>`;
                    break;
                 }
                 responseText += chunk;
                 
                 setSessions(prev => {
                    return prev.map(s => {
                        if (s.id !== activeSessionId) return s;
                        return {
                            ...s,
                            threads: s.threads.map(t => {
                                if (t.id !== s.activeThreadId) return t;
                                const newMessages = [...t.chatMessages];
                                newMessages[messageIndex] = {
                                    ...newMessages[messageIndex],
                                    text: responseText,
                                };
                                return { ...t, chatMessages: newMessages };
                            })
                        }
                    })
                 });
            }

            setSessions(prevSessions => {
                return prevSessions.map(s => {
                    if (s.id !== activeSessionId) return s;
                    return {
                        ...s,
                        threads: s.threads.map(t => {
                            if (t.id !== s.activeThreadId) return t;
                            
                            const newMessages = [...t.chatMessages];
                            // Only now do we push the previous text to history to "finalize" the version
                            newMessages[messageIndex] = {
                                ...newMessages[messageIndex],
                                text: responseText,
                                history: [previousText, ...(newMessages[messageIndex].history || [])],
                            };

                            return {
                                ...t,
                                chatHistory: [...t.chatHistory, { role: 'user', parts: [{ text: finalPrompt }] }, { role: 'model', parts: [{ text: responseText }] }],
                                chatMessages: newMessages,
                            };
                        })
                    };
                });
            });

        } catch (err) {
            alert(`Error regenerating response: ${err}`);
        } finally {
            setIsSending(false);
            isRequestCancelledRef.current = false;
        }
    };

    const handleResponseGeneration = (options: ChatResponseOptions) => {
        setLastChatResponseOptions(options);

        // Case 1: Starting a new thread from the main menu flow
        if (pendingGenerationDetails) {
            const finalPrompt = handleSendMessageWithOptions(pendingGenerationDetails.prompt, options);
            
            setAutoGenerationTask({
                type: pendingGenerationDetails.threadType,
                prompt: finalPrompt, // Send the fully constructed prompt
                topicSelection: pendingGenerationDetails.topicSelection
            });

            // Clean up all pending state related to this flow
            setPendingGenerationDetails(null);
            setPendingThreadType(null);
            setResponseOptionsContext(null);
            setIsResponseOptionsModalOpen(false);
            return; // Exit here for this case
        }

        // Case 2: Generating or regenerating a response within an existing chat thread
        if (responseOptionsContext) {
            const { type, userPrompt, messageIndex } = responseOptionsContext;

            if (type === 'generate') {
                performSendMessage(userPrompt, responseOptionsContext, options);
            } else if (type === 'regenerate' && messageIndex !== undefined) {
                performRegenerateMessage(userPrompt, messageIndex, options);
            }
        }
        
        // General cleanup for Case 2
        setResponseOptionsContext(null);
        setIsResponseOptionsModalOpen(false);
    };

    const handleInitiateSend = (prompt: string, contextOverride?: Partial<ChatModalContext>) => {
        const context: ChatModalContext = {
            type: 'generate',
            userPrompt: prompt,
            ...contextOverride,
        };
        setResponseOptionsContext(context);
        setIsResponseOptionsModalOpen(true);
    };

    const handleStopGeneration = () => {
        isRequestCancelledRef.current = true;
        // We don't set isSending to false immediately here,
        // we let the loop break in performSendMessage handle the cleanup and final state update.
        // This ensures the "Stopped" message is appended correctly.
    };
    
    // Quiz Handlers
    const handleQuizAnswer = (answer: string) => {
        if (!quizState) return;
        const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
        const isCorrect = currentQuestion.answer === answer;
        
        setQuizState(prev => prev ? ({
            ...prev,
            userAnswers: [...prev.userAnswers, { question: currentQuestion.question, answer, isCorrect }],
            score: isCorrect ? prev.score + 1 : prev.score
        }) : null);
    };

    const handleQuizNext = () => {
        setQuizState(prev => prev ? ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1, timeRemaining: prev.timeLimit }) : null);
    };

    const handleQuizTimeUp = () => {
        setQuizState(prev => {
            if (!prev || prev.timeRemaining <= 1) {
                const currentQuestion = prev!.questions[prev!.currentQuestionIndex];
                const alreadyAnswered = prev!.userAnswers.some(ua => ua.question === currentQuestion.question);
                if (!alreadyAnswered) {
                    // Mark as incorrect if not answered
                     return {
                        ...prev!,
                        userAnswers: [...prev!.userAnswers, { question: currentQuestion.question, answer: "Time's Up", isCorrect: false }],
                    };
                }
                return prev;
            }
            return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
    };
    
    const handleRetakeQuiz = () => {
        if(quizState?.quizOptions) {
             // We need to re-trigger generation. 
             // Re-opening menu to ensure fresh state
             setPendingThreadType('quiz');
             setIsTopicModalOpen(true);
        }
    };
    
    const handleDeleteMessage = (messageIndex: number) => {
        if (!activeSession || !activeThread) return;
        
        openConfirmation(
            "Delete Message",
            "Are you sure you want to delete this message? This action cannot be undone.",
            () => {
                setSessions(prevSessions => prevSessions.map(s => {
                    if (s.id !== activeSessionId) return s;
                    return {
                        ...s,
                        threads: s.threads.map(t => {
                            if (t.id !== s.activeThreadId) return t;
                            const newMessages = t.chatMessages.filter((_, i) => i !== messageIndex);
                            return { ...t, chatMessages: newMessages };
                        })
                    };
                }));
            }
        );
    };
    
    // --- History Management Handlers ---
    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        setIsHistoryPanelOpen(false); // Close panel on selection
        setAppState("PDF_READY"); // FIX: Ensure state updates
    };

    const handleSelectThread = (threadId: string) => {
        if (activeSession) {
            const updatedSession = { ...activeSession, activeThreadId: threadId };
            setSessions(sessions.map(s => s.id === activeSessionId ? updatedSession : s));
        }
        setIsHistoryPanelOpen(false); // Close panel on selection
    };

    const handleDeleteSession = (sessionId: string) => {
        openConfirmation(
            "Delete Document",
            "Are you sure you want to delete this document and all its history? This action cannot be undone.",
            () => {
                 setSessions(currentSessions => {
                    const remainingSessions = currentSessions.filter(s => s.id !== sessionId);
                    if (activeSessionId === sessionId) {
                        // We need to update activeSessionId outside this callback or use a layout effect, 
                        // but for simplicity we trigger the state update for activeSessionId here if needed.
                        // Since setState is async, we can just set it directly.
                        setActiveSessionId(remainingSessions[0]?.id || null);
                    }
                    return remainingSessions;
                });
            }
        );
    };
    
    const handleDeleteThread = (sessionId: string, threadId: string) => {
        openConfirmation(
            "Delete Chat",
            "Are you sure you want to delete this chat thread? This action cannot be undone.",
            () => {
                setSessions(prevSessions => prevSessions.map(s => {
                    if (s.id !== sessionId) return s;
                    
                    const updatedThreads = s.threads.filter(t => t.id !== threadId);
                    let newActiveThreadId = s.activeThreadId;

                    if (s.activeThreadId === threadId) {
                        newActiveThreadId = updatedThreads[updatedThreads.length - 1]?.id || null;
                    }
                    
                    return { ...s, threads: updatedThreads, activeThreadId: newActiveThreadId };
                }));
            }
        );
    };

    const handleUpdateThreadTitle = (threadId: string, newTitle: string) => {
        if (!activeSession) return;
        
        const updatedThreads = activeSession.threads.map(t =>
            t.id === threadId ? { ...t, title: newTitle } : t
        );
        const updatedSession = { ...activeSession, threads: updatedThreads };
        setSessions(sessions.map(s => s.id === activeSessionId ? updatedSession : s));
    };


    const handleClearAllHistory = () => {
        openConfirmation(
            "Clear All History",
            "Are you sure you want to delete ALL chat history and documents? This action is irreversible.",
            () => {
                setSessions([]);
                setActiveSessionId(null);
                localStorage.removeItem('chatSessions');
                localStorage.removeItem('activeSessionId');
                localStorage.removeItem('lastChatResponseOptions');
                setAppState("AWAITING_PDF");
            }
        );
    };
    

    const renderContent = () => {
        switch (appState) {
            case "AWAITING_PDF":
                return <LandingPage 
                            onFileSelect={selectFile}
                            onOpenHistory={() => setIsHistoryPanelOpen(true)}
                       />;
            case "PROCESSING_PDF":
                return <ProcessingPage />;
            case "GENERATING_INDEX":
                return <GeneratingIndexPage />;
            case "ERROR":
                // Basic error display for now. Could be a dedicated component.
                return <div className="flex items-center justify-center h-full bg-red-100 text-red-800 p-4">{error}</div>;
            case "PDF_READY":
                if (!activeSession) {
                    return <div className="flex items-center justify-center h-full">Error: No active session found.</div>;
                }
                if (quizState?.isActive) {
                    return <QuizView 
                                quizState={quizState} 
                                onAnswer={handleQuizAnswer}
                                onNext={handleQuizNext}
                                onRetake={handleRetakeQuiz}
                                onBackToMenu={handleBackToMenu}
                                onTimeUp={handleQuizTimeUp}
                           />
                }
                if (activeThread) {
                    return <ChatView
                                currentSession={activeSession}
                                currentChatThread={activeThread}
                                isSending={isSending}
                                onInitiateSend={(msg) => handleInitiateSend(msg)}
                                onRegenerate={(ctx) => handleInitiateSend(ctx.userPrompt, { type: 'regenerate', messageIndex: ctx.messageIndex })}
                                onDeleteMessage={handleDeleteMessage}
                                onStopGeneration={handleStopGeneration}
                                onBackToMenu={handleBackToMenu}
                                onNewThread={(type) => startNewThread(type)}
                                onOpenHistory={() => setIsHistoryPanelOpen(true)}
                                onDeleteCurrentThread={() => {
                                    handleDeleteThread(activeSession.id, activeThread.id);
                                }}
                           />;
                }
                return <MenuPage
                            fileName={activeSession.fileName}
                            fileSize={formatBytes(activeSession.fileSize)}
                            numPages={activeSession.numPages}
                            onMenuAction={handleMenuAction}
                            onNewDocument={handleNewDocument}
                            onDeleteDocument={() => handleDeleteSession(activeSession.id)}
                            onOpenHistory={() => setIsHistoryPanelOpen(true)}
                       />;
            default:
                return null;
        }
    };
    
    return (
        <div className="h-screen w-screen bg-white dark:bg-slate-900 overflow-hidden">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.txt" className="hidden" />
            
            {renderContent()}

            {activeSession && (
                <TopicSelectionModal 
                    isOpen={isTopicModalOpen}
                    onClose={() => setIsTopicModalOpen(false)}
                    onSelect={handleTopicSelectForThread}
                    indexData={activeSession.indexData}
                />
            )}
            
            <GenerationConfigModal 
                isOpen={isGenerationConfigModalOpen}
                onClose={() => setIsGenerationConfigModalOpen(false)}
                onGenerate={handleGenerateFromConfig}
                threadType={pendingThreadType}
            />

            <ChatResponseOptionsModal 
                isOpen={isResponseOptionsModalOpen}
                onClose={() => setIsResponseOptionsModalOpen(false)}
                onGenerate={handleResponseGeneration}
                context={responseOptionsContext}
                initialOptions={lastChatResponseOptions}
            />
            
            <LectureModeSelectionModal 
                isOpen={isLectureModeModalOpen}
                onClose={() => setIsLectureModeModalOpen(false)}
                onSelect={handleLectureModeSelect}
            />
            
            <HistorySidePanel
                isOpen={isHistoryPanelOpen}
                onClose={() => setIsHistoryPanelOpen(false)}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onSelectThread={handleSelectThread}
                onDeleteSession={handleDeleteSession}
                onDeleteThread={handleDeleteThread}
                onUpdateThreadTitle={handleUpdateThreadTitle}
                onClearAllHistory={handleClearAllHistory}
            />
            
            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                title={confirmationModal.title}
                message={confirmationModal.message}
                onConfirm={confirmationModal.onConfirm}
                onClose={closeConfirmation}
            />

        </div>
    );
};

export default App;
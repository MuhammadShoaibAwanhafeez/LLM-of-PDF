import React from 'react';
import { MessageSquare, ImageIcon, Sparkles } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  return (
    <nav className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 hidden md:block">
          Gemini
        </span>
      </div>

      <div className="flex-1 py-6 space-y-2 px-3">
        <button
          onClick={() => onViewChange(AppView.CHAT)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
            currentView === AppView.CHAT
              ? 'bg-blue-600/10 text-blue-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <MessageSquare className="w-5 h-5 shrink-0" />
          <span className="font-medium hidden md:block">Chat</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.IMAGE)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
            currentView === AppView.IMAGE
              ? 'bg-purple-600/10 text-purple-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <ImageIcon className="w-5 h-5 shrink-0" />
          <span className="font-medium hidden md:block">Generate Image</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 text-slate-500 text-sm px-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="hidden md:block">System Online</span>
        </div>
      </div>
    </nav>
  );
};
import React from "react";
import { GraduationCap, Sparkles, MessageSquare } from "lucide-react";

interface HeaderProps {
  onOpenChat: () => void;
  onScrollToFeatures: () => void;
  onScrollToPractice: () => void;
}

export default function Header({
  onOpenChat,
  onScrollToFeatures,
  onScrollToPractice,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-100">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-sans text-xl font-bold tracking-tight text-slate-900">
            EduShape
          </span>
        </div>

        {/* Minimalist Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={onScrollToFeatures}
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Features
          </button>
          <button
            onClick={onScrollToPractice}
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Practice Quizzes
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition-all duration-200"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Ask AI Tutor</span>
          </button>
        </div>
      </div>
    </header>
  );
}

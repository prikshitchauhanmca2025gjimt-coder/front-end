import React, { useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Features from "./components/Features";
import PracticeQuiz from "./components/PracticeQuiz";
import Chatbot from "./components/Chatbot";
import { MessageSquare, Sparkles, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const triggerNotification = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/20 font-sans antialiased text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-center gap-2.5 rounded-xl border p-4 shadow-lg animate-slide-in bg-white ${
              n.type === "success"
                ? "border-emerald-100 text-emerald-800"
                : n.type === "error"
                ? "border-rose-100 text-rose-800"
                : "border-slate-100 text-slate-800"
            }`}
          >
            {n.type === "success" && <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />}
            {n.type === "error" && <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />}
            {n.type === "info" && <Info className="h-5 w-5 text-indigo-600 shrink-0" />}
            <span className="text-sm font-semibold">{n.message}</span>
          </div>
        ))}
      </div>

      {/* Primary Header */}
      <Header
        onOpenChat={() => setIsChatOpen(true)}
        onScrollToFeatures={() => scrollToSection("features")}
        onScrollToPractice={() => scrollToSection("practice")}
      />

      {/* Main Structural Stream */}
      <main className="relative">
        <Hero
          onOpenChat={() => setIsChatOpen(true)}
        />

        <Features />

        <PracticeQuiz onNotify={triggerNotification} />
      </main>

      {/* Side Slide-over Chatbot Panel */}
      <Chatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onNotify={triggerNotification}
      />

      {/* Persistent Floating Chat Trigger (when chatbot drawer is closed) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 rounded-full bg-indigo-600 p-4 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-[0.98] transition-all duration-300 cursor-pointer"
          id="floating-chat-trigger"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="max-w-0 overflow-hidden font-semibold text-sm whitespace-nowrap group-hover:max-w-32 transition-all duration-300">
            Ask AI Tutor
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-200 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-300"></span>
          </span>
        </button>
      )}

      {/* Simple Elegant Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold animate-pulse">
              E
            </div>
            <span className="font-sans font-bold text-lg text-white">EduShape</span>
          </div>
          <p className="text-sm max-w-md mx-auto leading-relaxed">
            EduShape helps you shape your career. Personalizing secondary and high-level academic concepts through distraction-free, intelligent interfaces.
          </p>
          <div className="mt-8 border-t border-slate-800 pt-8 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-4">
            <span>&copy; {new Date().getFullYear()} EduShape Platform. Built with Google Gemini 3.5.</span>
            <div className="flex gap-4 justify-center">
              <span className="hover:text-white transition-colors cursor-pointer">Terms</span>
              <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
              <span className="hover:text-white transition-colors cursor-pointer">Help Guides</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

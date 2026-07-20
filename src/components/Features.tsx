import React from "react";
import { Sparkles, GraduationCap, CheckCircle, Brain, BookOpen } from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            A Distraction-Free Space Built for True Comprehension
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Forget infinite scrolling and unstructured notes. EduShape provides a focused suite
            of interactive features to transform how you study.
          </p>
        </div>

        {/* Bento Grid Features Layout */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Live AI Chatbot */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-8 transition-all hover:border-slate-200/80 hover:bg-slate-50">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-6">
              <Brain className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Conversational AI Tutor</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Ask questions naturally. The integrated tutor understands context, explains tricky equations,
              and supports formatted code blocks or step-by-step guides.
            </p>
          </div>

          {/* Card 2: Interactive Subject Hub */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-8 transition-all hover:border-slate-200/80 hover:bg-slate-50">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-6">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Instant Curated Topics</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Browse Mathematics, physics, Computer Science, and history. Select any sub-topic to
              instantly load specific prompt context and talk to the tutor directly.
            </p>
          </div>

          {/* Card 3: Adaptive Quizzes */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-8 transition-all hover:border-slate-200/80 hover:bg-slate-50 sm:col-span-2 lg:col-span-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-6">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Dynamic Practice Quizzes</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Generate custom three-question practice quizzes on any subject using our live AI model.
              Receive instant answers, grades, and explanatory feedback.
            </p>
          </div>

          {/* Large Highlight Row: Analogy Mode */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-linear-to-r from-indigo-50/20 to-white p-8 sm:col-span-2 lg:col-span-3 flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 mb-4">
                <Sparkles className="h-3 w-3" />
                <span>Featured Tech</span>
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                Learn from Academic Depth to Simple Analogy
              </h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Sometimes dry textbook explanations don't stick. The AI Tutor is uniquely optimized to
                toggle between rigorous academic proofs and playful real-world analogies (e.g., explaining
                "API routes" as a "restaurant waiter passing requests to the kitchen"). Select different
                prompt styles inside the chatbot to experience it!
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-xs max-w-xs shrink-0">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="h-2 w-2 rounded-full bg-indigo-600"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Example Analogy</span>
              </div>
              <p className="text-xs text-slate-700 italic leading-relaxed">
                "Think of the mitochondria as a mini electrical generator inside a house. It converts the raw
                fuel (food) into clean voltage (ATP) that powers all your household appliances."
              </p>
              <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-600">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Clear & memorable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

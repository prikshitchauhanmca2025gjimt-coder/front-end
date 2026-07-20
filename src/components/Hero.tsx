import React from "react";
import { motion } from "motion/react";
import { Sparkles, MessageSquare, ArrowRight, BrainCircuit, Globe, Clock } from "lucide-react";

interface HeroProps {
  onOpenChat: () => void;
}

export default function Hero({ onOpenChat }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-radial from-slate-50 to-white py-20 sm:py-28">
      {/* Decorative ambient background blur lights */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-100 blur-3xl opacity-60"></div>
      <div className="absolute top-1/3 left-1/3 -z-10 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-50 blur-3xl opacity-55"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full bg-indigo-50/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-indigo-700 border border-indigo-100/60"
        >
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>Next-Generation Personalized Learning</span>
        </motion.div>

        {/* Core Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto max-w-3xl font-sans text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
        >
          Master Any Subject with{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
            Personalized AI
          </span>{" "}
          Guidance
        </motion.h1>

        {/* Sub-headline / Descriptive text */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed"
        >
          EduShape helps you shape your career. Step into a distraction-free learning
          ecosystem where EduShape pairs you with an expert AI Tutor to clear doubts,
          run interactive practices, and break down complex topics 24/7.
        </motion.p>

        {/* CTA Button Group */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onOpenChat}
            className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-md hover:bg-indigo-700 hover:shadow-indigo-100 active:scale-[0.98] transition-all duration-200"
          >
            <MessageSquare className="h-5 w-5" />
            <span>Chat with AI Tutor</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Key Features Quick Icons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto mt-20 max-w-5xl border-t border-slate-100 pt-10"
        >
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center p-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Always Available</h3>
              <p className="mt-1 text-sm text-slate-500">
                Get clear explanations instantly, day or night, without waiting.
              </p>
            </div>
            <div className="flex flex-col items-center p-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Adaptive Intellect</h3>
              <p className="mt-1 text-sm text-slate-500">
                Concepts are tailored to your pace, using simplified analogies or depth.
              </p>
            </div>
            <div className="flex flex-col items-center p-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Universal Scope</h3>
              <p className="mt-1 text-sm text-slate-500">
                From STEM equations to literature analysis, master any domain.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

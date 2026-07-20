import React, { useState } from "react";
import { Sparkles, BrainCircuit, CheckCircle2, XCircle, ChevronRight, RefreshCw, Trophy } from "lucide-react";
import { QuizQuestion, QuizState } from "../types";

// Standard preset quiz in case AI is loading or not configured
const PRESET_QUIZ: QuizQuestion[] = [
  {
    question: "Which of the following describes the Big O notation of a binary search algorithm on a sorted array?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswer: 1,
    explanation: "Binary search repeatedly divides the search interval in half. Therefore, the time complexity is logarithmic, or O(log n).",
  },
  {
    question: "What physical quantity does entropy measure in a thermodynamic system?",
    options: ["Thermal conductivity", "Total kinetic energy", "Molecular disorder or randomness", "Gravitational potential"],
    correctAnswer: 2,
    explanation: "In thermodynamics, entropy is a measure of the molecular disorder, randomness, or uncertainty within a closed system.",
  },
  {
    question: "Which theorem connects the concept of differentiating a function with integrating a function?",
    options: [
      "Pythagorean Theorem",
      "Mean Value Theorem",
      "Fundamental Theorem of Calculus",
      "Central Limit Theorem",
    ],
    correctAnswer: 2,
    explanation: "The Fundamental Theorem of Calculus states that differentiation and integration are inverse operations, connecting slopes with accumulated areas.",
  },
];

interface PracticeQuizProps {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
}

export default function PracticeQuiz({ onNotify }: PracticeQuizProps) {
  const [topic, setTopic] = useState("Quantum Physics basics");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizState>({
    questions: PRESET_QUIZ,
    currentIndex: 0,
    selectedAnswers: {},
    isSubmitted: false,
  });

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a 3-question multiple-choice quiz about "${topic}".
Format the output STRICTLY as a valid JSON array of objects. Do NOT include markdown code fences or backticks (no \`\`\`json or \`\`\`). Only return raw JSON content matching this TypeScript type:
Array<{
  question: string;
  options: string[]; // exactly 4 options
  correctAnswer: number; // 0-based index of the correct answer
  explanation: string;
}>`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate quiz.");
      }

      // Extract JSON from response text
      let cleanedText = data.text.trim();
      // Remove possible markdown fences if returned
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json/, "").replace(/```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```/, "").replace(/```$/, "");
      }
      cleanedText = cleanedText.trim();

      const questions: QuizQuestion[] = JSON.parse(cleanedText);
      if (Array.isArray(questions) && questions.length > 0) {
        setQuiz({
          questions,
          currentIndex: 0,
          selectedAnswers: {},
          isSubmitted: false,
        });
        onNotify("Successfully generated customized quiz!", "success");
      } else {
        throw new Error("Invalid format returned by AI.");
      }
    } catch (err: any) {
      console.error(err);
      onNotify("Couldn't generate customized quiz. Loaded our hand-crafted preset quiz instead!", "info");
      // Fallback to presets with a randomized order or just reset
      setQuiz({
        questions: PRESET_QUIZ,
        currentIndex: 0,
        selectedAnswers: {},
        isSubmitted: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = quiz.questions[quiz.currentIndex];
  const hasSelected = quiz.selectedAnswers[quiz.currentIndex] !== undefined;
  const currentSelection = quiz.selectedAnswers[quiz.currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    if (quiz.isSubmitted) return;
    setQuiz((prev) => ({
      ...prev,
      selectedAnswers: {
        ...prev.selectedAnswers,
        [prev.currentIndex]: optionIndex,
      },
    }));
  };

  const handleNext = () => {
    if (quiz.currentIndex < quiz.questions.length - 1) {
      setQuiz((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    } else {
      const finalAnswers = { ...quiz.selectedAnswers };
      const computedScore = quiz.questions.reduce((acc, q, idx) => {
        return acc + (finalAnswers[idx] === q.correctAnswer ? 1 : 0);
      }, 0);

      setQuiz((prev) => ({ ...prev, isSubmitted: true }));

      // Sync completed quiz results to backend dashboard
      import("../lib/sync").then(({ syncEvent }) => {
        syncEvent("quiz_result", {
          topic,
          score: computedScore,
          totalQuestions: quiz.questions.length,
          questions: quiz.questions.map((q, idx) => ({
            question: q.question,
            correct: finalAnswers[idx] === q.correctAnswer,
            selectedOption: q.options[finalAnswers[idx]] || "None",
            correctOption: q.options[q.correctAnswer]
          }))
        }).then((res) => {
          if (res.success) {
            onNotify("Quiz performance synced to backend dashboard!", "success");
          }
        });
      });
    }
  };

  const score = quiz.questions.reduce((acc, q, idx) => {
    return acc + (quiz.selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
  }, 0);

  const resetQuiz = () => {
    setQuiz({
      questions: quiz.questions,
      currentIndex: 0,
      selectedAnswers: {},
      isSubmitted: false,
    });
  };

  return (
    <section id="practice" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Active Recall</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Interactive AI Study Quizzes
          </h2>
          <p className="mt-3 text-lg text-slate-600">
            Assess your understanding immediately. Enter any topic below, and our server-side AI will build a personalized quiz for you on the fly.
          </p>
        </div>

        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-slate-50/40 p-6 sm:p-8">
          {/* Generator Input */}
          <form onSubmit={handleGenerateQuiz} className="mb-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis, General Relativity, Binary Search"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400 transition-all duration-200"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Quiz</span>
                </>
              )}
            </button>
          </form>

          {/* Quiz Container */}
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-xs">
            {!quiz.isSubmitted ? (
              currentQuestion ? (
                <div>
                  {/* Progress Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Question {quiz.currentIndex + 1} of {quiz.questions.length}
                    </span>
                    <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{
                          width: `${((quiz.currentIndex + 1) / quiz.questions.length) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Question */}
                  <h3 className="font-semibold text-slate-900 text-lg mb-6">
                    {currentQuestion.question}
                  </h3>

                  {/* Options */}
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected = currentSelection === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(idx)}
                          className={`flex items-center justify-between p-4 rounded-xl border text-left text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "border-slate-100 bg-slate-50/30 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span>{option}</span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Controls / Feedback */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      Select an option to proceed.
                    </div>
                    <button
                      onClick={handleNext}
                      disabled={!hasSelected}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all cursor-pointer"
                    >
                      <span>
                        {quiz.currentIndex === quiz.questions.length - 1 ? "Finish Quiz" : "Next Question"}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No questions loaded. Enter a topic above to begin!</p>
                </div>
              )
            ) : (
              /* Score Card */
              <div className="text-center py-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
                  <Trophy className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-slate-900 text-2xl">Quiz Completed!</h3>
                <p className="text-slate-600 mt-2 text-sm">
                  You scored <span className="font-bold text-indigo-600">{score}</span> out of{" "}
                  <span className="font-bold">{quiz.questions.length}</span>
                </p>

                {/* Question Breakdown with Explanations */}
                <div className="mt-8 text-left border-t border-slate-100 pt-6 max-h-96 overflow-y-auto pr-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Review Answers</h4>
                  <div className="flex flex-col gap-6">
                    {quiz.questions.map((q, idx) => {
                      const userAns = quiz.selectedAnswers[idx];
                      const isCorrect = userAns === q.correctAnswer;
                      return (
                        <div key={idx} className="border-b border-slate-50 pb-4 last:border-0">
                          <h5 className="font-medium text-slate-800 text-sm mb-2">
                            {idx + 1}. {q.question}
                          </h5>
                          <div className="flex flex-wrap gap-4 text-xs font-semibold mb-2">
                            <span className="flex items-center gap-1 text-slate-500">
                              Your answer:{" "}
                              <span
                                className={`inline-flex items-center gap-1 font-bold ${
                                  isCorrect ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {userAns !== undefined ? q.options[userAns] : "Skipped"}
                                {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              </span>
                            </span>
                            {!isCorrect && (
                              <span className="text-slate-500">
                                Correct: <span className="text-emerald-600 font-bold">{q.options[q.correctAnswer]}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg leading-relaxed border-l-2 border-slate-300">
                            {q.explanation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                  <button
                    onClick={resetQuiz}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  BookOpen,
  HelpCircle,
  Trash2,
  Bookmark,
  GraduationCap,
  Settings,
  Link,
} from "lucide-react";
import { ChatMessage } from "../types";
import { syncEvent, subscribeToSyncLogs, getDashboardUrl, setDashboardUrl, SyncLog } from "../lib/sync";

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopicPrompt?: string;
  onClearInitialPrompt?: () => void;
  onNotify: (message: string, type: "success" | "error" | "info") => void;
}

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage is not accessible:", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage is not accessible:", e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage is not accessible:", e);
    }
  }
};

const PRESET_QUICK_QUESTIONS = [
  "1️⃣ Student",
  "2️⃣ Parent",
  "3️⃣ Teacher",
];

export interface UserProfile {
  role?: "Student" | "Parent" | "Teacher";
  name?: string;
  studentId?: string;
  teacherId?: string;
  class?: string;
  subject?: string;
  course?: string;
  learningGoal?: string;
  childName?: string;
  profile_completed?: boolean;
}

export default function Chatbot({
  isOpen,
  onClose,
  initialTopicPrompt,
  onClearInitialPrompt,
  onNotify,
}: ChatbotProps) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = safeStorage.getItem("edubot_user_profile");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return {};
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Attempt to load from storage to persist session
    const stored = safeStorage.getItem("edubot_chat_history");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      } catch (e) {
        // ignore fallback
      }
    }

    const storedProfile = safeStorage.getItem("edubot_user_profile");
    if (storedProfile) {
      try {
        const p = JSON.parse(storedProfile);
        if (p.profile_completed && p.role && p.name) {
          let greet = "";
          if (p.role === "Student") greet = `Welcome back ${p.name} 👋`;
          else if (p.role === "Teacher") greet = `Welcome back ${p.name} 👨‍🏫`;
          else if (p.role === "Parent") greet = `Welcome back ${p.name} 👨\u200D👩\u200D👧`;
          return [
            {
              id: "welcome",
              role: "model",
              text: greet,
              timestamp: new Date(),
            },
          ];
        }
      } catch (e) {}
    }

    return [
      {
        id: "welcome",
        role: "model",
        text: "Hello 👋 Welcome to EduBot!\n\nI'm your AI Learning Companion.\n\nPlease tell me who you are:\n\n1️⃣ Student\n2️⃣ Parent\n3️⃣ Teacher",
        timestamp: new Date(),
      },
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // n8n Connection States (persisted in safeStorage)
  const [useN8N, setUseN8N] = useState<boolean>(() => {
    return safeStorage.getItem("use_n8n") === "true";
  });
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>(() => {
    return safeStorage.getItem("n8n_webhook_url") || "";
  });
  const [n8nInputKey, setN8nInputKey] = useState<string>(() => {
    return safeStorage.getItem("n8n_input_key") || "chatInput";
  });
  const [n8nOutputKey, setN8nOutputKey] = useState<string>(() => {
    return safeStorage.getItem("n8n_output_key") || "output";
  });
  const [showN8nSettings, setShowN8nSettings] = useState<boolean>(false);
  const [sessionId] = useState<string>(() => {
    const existing = safeStorage.getItem("edubot_session_id");
    if (existing) return existing;
    const newId = `session-${Date.now()}`;
    safeStorage.setItem("edubot_session_id", newId);
    return newId;
  });

  // AI Engine Provider (defaults to 'openai' for ChatGPT)
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">(() => {
    return (safeStorage.getItem("ai_provider") as "gemini" | "openai") || "openai";
  });

  // Response tone style customization
  const [toneStyle, setToneStyle] = useState<"standard" | "analogy" | "rigorous" | "summary">("standard");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load previous chat history from backend database (with Firebase and local fallback)
  useEffect(() => {
    const loadDBHistory = async () => {
      try {
        const response = await fetch(`/api/db/history/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.history && data.history.length > 0) {
            const loaded = data.history.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }));
            setMessages(loaded);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to load history from database:", err);
      }
    };

    if (isOpen) {
      loadDBHistory();
    }
  }, [isOpen, sessionId]);

  // Persist chat history changes to client storage
  useEffect(() => {
    safeStorage.setItem("edubot_chat_history", JSON.stringify(messages));
  }, [messages]);

  // Synchronize new messages to the database automatically
  const lastSavedMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    // Don't save if it's the welcome message or if we already saved it
    if (lastMsg.id === "welcome" || lastMsg.id === lastSavedMessageIdRef.current) return;
    // Don't save transient connection errors
    if (lastMsg.id.startsWith("err-")) return;

    lastSavedMessageIdRef.current = lastMsg.id;

    const saveMessage = async () => {
      try {
        await fetch("/api/db/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: lastMsg }),
        });
      } catch (err) {
        console.warn("Error persisting message to database:", err);
      }
    };

    saveMessage();
  }, [messages, sessionId]);

  // Synchronize user profile updates to the database automatically
  const lastSavedProfileRef = useRef<string>("");
  useEffect(() => {
    if (!profile || Object.keys(profile).length === 0) return;
    const profileStr = JSON.stringify(profile);
    if (profileStr === lastSavedProfileRef.current) return;
    lastSavedProfileRef.current = profileStr;

    const saveProfile = async () => {
      try {
        const userId = profile.studentId || profile.teacherId || profile.name || "anonymous-user";
        await fetch("/api/db/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, profile }),
        });
      } catch (err) {
        console.warn("Error persisting profile to database:", err);
      }
    };

    saveProfile();
  }, [profile]);

  // Focus and scroll helper
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // Load initial prompt if chosen from the SubjectHub
  useEffect(() => {
    if (initialTopicPrompt && isOpen) {
      handleSendMessage(initialTopicPrompt);
      if (onClearInitialPrompt) {
        onClearInitialPrompt();
      }
    }
  }, [initialTopicPrompt, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    // Append user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    // Sync user message to backend dashboard
    syncEvent("chat_message", { role: "user", text: trimmed });

    // Client-side deterministic profile registration flow
    if (!profile.profile_completed) {
      setTimeout(() => {
        let nextText = "";
        const updatedProfile = { ...profile };

        // Step 1: Detect and set role
        if (!profile.role) {
          const lowerText = trimmed.toLowerCase();
          let parsedRole: "Student" | "Parent" | "Teacher" | null = null;
          if (lowerText.includes("student") || trimmed === "1" || trimmed.includes("1️⃣")) {
            parsedRole = "Student";
          } else if (lowerText.includes("parent") || trimmed === "2" || trimmed.includes("2️⃣")) {
            parsedRole = "Parent";
          } else if (lowerText.includes("teacher") || trimmed === "3" || trimmed.includes("3️⃣")) {
            parsedRole = "Teacher";
          }

          if (parsedRole) {
            updatedProfile.role = parsedRole;
            nextText = `Great! Please tell me your Name:`;
          } else {
            nextText = `Hello 👋 Welcome to EduBot!\n\nI'm your AI Learning Companion.\n\nPlease tell me who you are:\n\n1️⃣ Student\n2️⃣ Parent\n3️⃣ Teacher`;
          }
        }
        // Step 2: Ask for Name
        else if (!profile.name) {
          updatedProfile.name = trimmed;
          if (profile.role === "Student") {
            nextText = `Please tell me your Student ID / Roll Number:`;
          } else if (profile.role === "Teacher") {
            nextText = `Please tell me your Teacher ID:`;
          } else if (profile.role === "Parent") {
            nextText = `Please tell me your Child's Name:`;
          }
        }
        // Step 3+: Role-specific collections
        else if (profile.role === "Student") {
          if (!profile.studentId) {
            updatedProfile.studentId = trimmed;
            nextText = `Please tell me your Class / Semester:`;
          } else if (!profile.class) {
            updatedProfile.class = trimmed;
            nextText = `Please tell me your Course / Program:`;
          } else if (!profile.course) {
            updatedProfile.course = trimmed;
            nextText = `Please tell me your Learning Goal:`;
          } else if (!profile.learningGoal) {
            updatedProfile.learningGoal = trimmed;
            updatedProfile.profile_completed = true;
            nextText = `Welcome ${profile.name || updatedProfile.name} 🎓\n\nYour profile has been created successfully.\n\nI can help you with:\n\n✅ Answering questions\n✅ Explaining concepts\n✅ Exam preparation\n✅ Assignments\n✅ Daily quizzes\n✅ Study plans\n✅ Progress tracking\n\nHow can I help you today?`;
          }
        } else if (profile.role === "Teacher") {
          if (!profile.studentId) {
            updatedProfile.studentId = trimmed;
            nextText = `Please tell me your Subject:`;
          } else if (!profile.course) {
            updatedProfile.course = trimmed;
            nextText = `Please tell me your Class:`;
          } else if (!profile.class) {
            updatedProfile.class = trimmed;
            updatedProfile.profile_completed = true;
            nextText = `Welcome ${profile.name || updatedProfile.name} 🎓\n\nYour profile has been created successfully.\n\nI can help you with:\n\n✅ Lesson plans\n✅ Teaching material\n✅ Quiz creation\n✅ Student analytics\n✅ Performance reports\n\nHow can I help you today?`;
          }
        } else if (profile.role === "Parent") {
          if (!profile.childName) {
            updatedProfile.childName = trimmed;
            nextText = `Please tell me your Child's Student ID:`;
          } else if (!profile.studentId) {
            updatedProfile.studentId = trimmed;
            nextText = `Please tell me your Child's Class:`;
          } else if (!profile.class) {
            updatedProfile.class = trimmed;
            updatedProfile.profile_completed = true;
            nextText = `Welcome ${profile.name || updatedProfile.name} 🎓\n\nYour profile has been created successfully.\n\nI can help you with:\n\n✅ Child progress reports\n✅ Learning recommendations\n✅ Quiz performance\n✅ Study guidance\n\nHow can I help you today?`;
          }
        }

        setProfile(updatedProfile);
        safeStorage.setItem("edubot_user_profile", JSON.stringify(updatedProfile));

        const botMsgOnboarding: ChatMessage = {
          id: `bot-onboard-${Date.now()}`,
          role: "model",
          text: nextText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, botMsgOnboarding]);
        setIsLoading(false);

        // Sync onboarding bot message
        syncEvent("chat_message", { role: "model", text: nextText });

        // If onboarding is now complete, sync user profile to backend dashboard
        if (updatedProfile.profile_completed) {
          syncEvent("onboarding_profile", updatedProfile);
        }
      }, 600);
      return;
    }

    // Dynamic routing: Route to N8N Proxy if integration is active
    if (useN8N) {
      if (!n8nWebhookUrl) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "model",
          text: "⚠️ **Setup Required**: Please click the ⚙️ settings icon at the top right of this chat window to set up your n8n Webhook URL first!",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        onNotify("n8n Webhook URL is missing", "error");
        return;
      }

      // Default tone prompt instructions for direct fallback
      let finalPrompt = trimmed;
      if (toneStyle === "analogy") {
        finalPrompt = `[Tone Instruction: Explain this using an engaging, creative analogy or real-world metaphor. Avoid dry math/academic formulas until the basic metaphor is fully explained.] ${trimmed}`;
      } else if (toneStyle === "rigorous") {
        finalPrompt = `[Tone Instruction: Give a highly academic, mathematically and scientifically precise explanation. Define all terms, include rigorous steps, and provide formal proofs if relevant.] ${trimmed}`;
      } else if (toneStyle === "summary") {
        finalPrompt = `[Tone Instruction: Synthesize the concepts down into ultra-concise bullet points, highlighting only core formulas or historical facts.] ${trimmed}`;
      }

      try {
        const response = await fetch("/api/n8n-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: n8nWebhookUrl,
            message: trimmed,
            sessionId,
            inputKey: n8nInputKey,
            outputKey: n8nOutputKey,
            history: updatedMessages.map((m) => ({
              role: m.role,
              text: m.text,
            })),
            provider: aiProvider,
            profile,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to reach n8n server proxy.");
        }

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "model",
          text: data.text || "I was unable to formulate a response. Let's try asking in a different way!",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, botMsg]);
        syncEvent("chat_message", { role: "model", text: botMsg.text });
      } catch (err: any) {
        console.log("Client-side direct assistant fallback triggered.");
        try {
          const directResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: finalPrompt,
              history: updatedMessages.map((m) => ({
                role: m.role,
                text: m.text,
              })),
              provider: aiProvider,
              profile,
            }),
          });
          const directData = await directResponse.json();
          if (!directResponse.ok) {
            throw new Error(directData.error || "Direct chat status offline.");
          }
          const botMsg: ChatMessage = {
            id: `bot-${Date.now()}`,
            role: "model",
            text: directData.text || "I was unable to formulate a response. Let's try asking in a different way!",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMsg]);
          syncEvent("chat_message", { role: "model", text: botMsg.text });
        } catch (directErr: any) {
          console.log("Direct backup chat routing update: offline.");
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "model",
            text: `⚠️ **Service Temporarily Offline**: We couldn't reach the AI tutor. Please check your network connection and API keys.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          onNotify("Connection error. Please try again.", "error");
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default: Route to Gemini AI API
    let finalPrompt = trimmed;
    if (toneStyle === "analogy") {
      finalPrompt = `[Tone Instruction: Explain this using an engaging, creative analogy or real-world metaphor. Avoid dry math/academic formulas until the basic metaphor is fully explained.] ${trimmed}`;
    } else if (toneStyle === "rigorous") {
      finalPrompt = `[Tone Instruction: Give a highly academic, mathematically and scientifically precise explanation. Define all terms, include rigorous steps, and provide formal proofs if relevant.] ${trimmed}`;
    } else if (toneStyle === "summary") {
      finalPrompt = `[Tone Instruction: Synthesize the concepts down into ultra-concise bullet points, highlighting only core formulas or historical facts.] ${trimmed}`;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalPrompt,
          history: updatedMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          provider: aiProvider,
          profile,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "An error occurred during tutor generation.");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "model",
        text: data.text || "I was unable to formulate a response. Try asking me in a different way!",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
      syncEvent("chat_message", { role: "model", text: botMsg.text });
    } catch (err: any) {
      console.error(err);
      const isOpenAI = aiProvider === "openai";
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "model",
        text: `⚠️ **Error**: ${err.message || (isOpenAI ? "Failed to reach ChatGPT. Please verify that your OpenAI API Key is configured properly." : "Failed to reach Gemini. Please verify that your GEMINI_API_KEY is configured in the secrets panel.")}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      onNotify(`Error connecting to AI Tutor (${isOpenAI ? "OpenAI" : "Gemini"}). Check API key settings.`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onNotify("Copied response to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    let greet = "Welcome back! History cleared. Let's tackle a new academic concept today. What are we studying?";
    if (profile && profile.profile_completed && profile.role && profile.name) {
      if (profile.role === "Student") greet = `Welcome back ${profile.name} 👋`;
      else if (profile.role === "Teacher") greet = `Welcome back ${profile.name} 👨‍🏫`;
      else if (profile.role === "Parent") greet = `Welcome back ${profile.name} 👨\u200D👩\u200D👧`;
    }
    setMessages([
      {
        id: "welcome",
        role: "model",
        text: greet,
        timestamp: new Date(),
      },
    ]);
    safeStorage.removeItem("edubot_chat_history");
    onNotify("Chat history cleared.", "info");
  };

  const getSuggestedQuestions = () => {
    if (!profile.profile_completed) {
      return PRESET_QUICK_QUESTIONS;
    }
    if (profile.role === "Student") {
      return [
        "DBMS help",
        "Explain Recursion in Java",
        "Exam preparation plan",
        "Take a daily quiz",
      ];
    }
    if (profile.role === "Teacher") {
      return [
        "Create a lesson plan",
        "Generate a lesson quiz",
        "Math tutoring material",
      ];
    }
    if (profile.role === "Parent") {
      return [
        "Check child's progress",
        "Get study guidance",
        "Daily learning recommendation",
      ];
    }
    return PRESET_QUICK_QUESTIONS;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-2xl transition-transform duration-300">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {useN8N ? "My Custom Chatbot" : "EduShape AI Tutor"}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {useN8N
                ? "Routed via n8n Webhook"
                : aiProvider === "openai"
                ? "Powered by ChatGPT (GPT-4o-mini)"
                : "Powered by Gemini 3.5 Flash"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* n8n Settings Toggle */}
          <button
            onClick={() => setShowN8nSettings(!showN8nSettings)}
            title="Configure n8n Webhook Chatbot"
            className={`rounded-lg p-2 cursor-pointer transition-colors ${
              showN8nSettings || useN8N
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
          
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Clear Chat History"
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tone Preference Selector / Active n8n Indicator */}
      {!showN8nSettings && (
        <div className="border-b border-slate-100 bg-slate-50/50 p-3 flex items-center justify-between gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-2">
            {useN8N ? "Integration Mode:" : "Explanation Style:"}
          </span>
          {useN8N ? (
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              <span>n8n Webhook Connected</span>
            </div>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={() => setToneStyle("standard")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  toneStyle === "standard"
                    ? "bg-white text-indigo-600 shadow-xs border border-slate-100"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setToneStyle("analogy")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  toneStyle === "analogy"
                    ? "bg-white text-indigo-600 shadow-xs border border-slate-100"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Explains using helpful real world analogies"
              >
                Analogy (ELI5)
              </button>
              <button
                onClick={() => setToneStyle("rigorous")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  toneStyle === "rigorous"
                    ? "bg-white text-indigo-600 shadow-xs border border-slate-100"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Deep academic formula, formal definitions and proofs"
              >
                Rigorous
              </button>
              <button
                onClick={() => setToneStyle("summary")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  toneStyle === "summary"
                    ? "bg-white text-indigo-600 shadow-xs border border-slate-100"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Concise synthesized bullet points"
              >
                Summary
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Panel Body: Dynamic based on settings toggle */}
      {showN8nSettings ? (
        <N8nSettingsPanel
          useN8N={useN8N}
          setUseN8N={setUseN8N}
          n8nWebhookUrl={n8nWebhookUrl}
          setN8nWebhookUrl={setN8nWebhookUrl}
          n8nInputKey={n8nInputKey}
          setN8nInputKey={setN8nInputKey}
          n8nOutputKey={n8nOutputKey}
          setN8nOutputKey={setN8nOutputKey}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          profile={profile}
          setProfile={setProfile}
          messages={messages}
          onSave={() => {
            setShowN8nSettings(false);
            onNotify("Configuration saved successfully!", "success");
          }}
          onCancel={() => setShowN8nSettings(false)}
          onShowResetConfirm={() => setShowResetConfirm(true)}
          onNotify={onNotify}
        />
      ) : (
        <>
          {/* Message History Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => {
              const isBot = msg.role === "model";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 max-w-[88%] ${
                    isBot ? "self-start" : "self-end ml-auto flex-row-reverse"
                  }`}
                >
                  {/* Profile Icon */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isBot ? "bg-indigo-50 text-indigo-600" : "bg-slate-900 text-white"
                    }`}
                  >
                    {isBot ? "AI" : "ME"}
                  </div>

                  {/* Message Content Bubble */}
                  <div className="relative group">
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isBot
                          ? "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"
                          : "bg-indigo-600 text-white rounded-tr-none"
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>
                    </div>

                    {/* Micro Action Bar (Copy Text) */}
                    {isBot && (
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={() => handleCopyText(msg.text, msg.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:shadow-xs transition-all cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3.5 max-w-[85%] self-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-none bg-slate-50 border border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">
                  {useN8N
                    ? "Querying your custom n8n Chatbot..."
                    : "Thinking and writing your educational guide..."}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompt Prompts */}
          {messages.length === 1 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Suggested Quick Doubts:
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {getSuggestedQuestions().map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/20 hover:text-indigo-600 transition-all text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="border-t border-slate-100 bg-white p-4"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={
                  isLoading
                    ? "Waiting for response..."
                    : useN8N
                    ? "Ask your n8n Chatbot..."
                    : `Ask custom doubts (${toneStyle} mode)...`
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shrink-0 cursor-pointer"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
          </form>
        </>
      )}

      {/* Custom Confirmation Dialog for Clear Chat */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-scale-up">
            <h4 className="font-sans font-bold text-slate-900 text-base mb-2">Clear Chat History?</h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed font-sans">
              Are you sure you want to clear this study session's chat history? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClearHistory();
                  setShowClearConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Profile Reset */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-scale-up">
            <h4 className="font-sans font-bold text-slate-900 text-base mb-2">Reset Profile & History?</h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed font-sans">
              Are you sure you want to reset your EduBot profile? This will clear all local history and restart your onboarding.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  safeStorage.removeItem("edubot_user_profile");
                  safeStorage.removeItem("edubot_chat_history");
                  setShowResetConfirm(false);
                  window.location.reload();
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface N8nSettingsPanelProps {
  useN8N: boolean;
  setUseN8N: (val: boolean) => void;
  n8nWebhookUrl: string;
  setN8nWebhookUrl: (val: string) => void;
  n8nInputKey: string;
  setN8nInputKey: (val: string) => void;
  n8nOutputKey: string;
  setN8nOutputKey: (val: string) => void;
  aiProvider: "gemini" | "openai";
  setAiProvider: (val: "gemini" | "openai") => void;
  profile: UserProfile;
  setProfile: (val: UserProfile) => void;
  messages: ChatMessage[];
  onSave: () => void;
  onCancel: () => void;
  onShowResetConfirm: () => void;
  onNotify: (message: string, type: "success" | "error" | "info") => void;
}

function N8nSettingsPanel({
  useN8N,
  setUseN8N,
  n8nWebhookUrl,
  setN8nWebhookUrl,
  n8nInputKey,
  setN8nInputKey,
  n8nOutputKey,
  setN8nOutputKey,
  aiProvider,
  setAiProvider,
  profile,
  setProfile,
  messages,
  onSave,
  onCancel,
  onShowResetConfirm,
  onNotify,
}: N8nSettingsPanelProps) {
  const [url, setUrl] = useState(n8nWebhookUrl);
  const [inputKey, setInputKey] = useState(n8nInputKey);
  const [outputKey, setOutputKey] = useState(n8nOutputKey);
  const [localProvider, setLocalProvider] = useState(aiProvider);
  const [syncUrl, setSyncUrl] = useState(getDashboardUrl);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showLogPayloadId, setShowLogPayloadId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToSyncLogs((logs) => {
      setSyncLogs(logs);
    });
  }, []);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      if (profile && profile.profile_completed) {
        await syncEvent("manual_force_sync_profile", profile);
      }
      if (messages && messages.length > 0) {
        await syncEvent("manual_force_sync_chats", {
          totalMessages: messages.length,
          messages: messages.map((m) => ({ role: m.role, text: m.text, time: m.timestamp })),
        });
      }
      onNotify("Manual sync finished! Check the Live Synchronization Logs below.", "success");
    } catch (e) {
      console.error(e);
      onNotify("Sync failed. Check connection or dashboard URL.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const isWorkflowUrl = url.includes("/workflow/");

  const handleFixWorkflowUrl = (type: "production" | "test") => {
    const targetPath = type === "production" ? "/webhook/" : "/webhook-test/";
    const corrected = url.replace("/workflow/", targetPath);
    setUrl(corrected);
  };

  const handleSave = () => {
    setN8nWebhookUrl(url);
    setN8nInputKey(inputKey);
    setN8nOutputKey(outputKey);
    setAiProvider(localProvider);
    setDashboardUrl(syncUrl);
    safeStorage.setItem("use_n8n", String(useN8N));
    safeStorage.setItem("n8n_webhook_url", url);
    safeStorage.setItem("n8n_input_key", inputKey);
    safeStorage.setItem("n8n_output_key", outputKey);
    safeStorage.setItem("ai_provider", localProvider);
    onSave();
  };

  const handleToggle = () => {
    const nextState = !useN8N;
    setUseN8N(nextState);
    safeStorage.setItem("use_n8n", String(nextState));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Profile Card if completed */}
      {profile && profile.profile_completed && (
        <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex-row flex items-center gap-2">
            <GraduationCap className="h-4.5 w-4.5 text-indigo-600" />
            <span>EduBot Profile Settings</span>
          </h4>
          <div className="text-xs text-slate-500 font-medium space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div><span className="font-bold text-slate-700 font-sans">Role:</span> {profile.role}</div>
            <div><span className="font-bold text-slate-700 font-sans">Name:</span> {profile.name}</div>
            {profile.studentId && <div><span className="font-bold text-slate-700 font-mono">Student ID:</span> {profile.studentId}</div>}
            {profile.teacherId && <div><span className="font-bold text-slate-700 font-mono">Teacher ID:</span> {profile.teacherId}</div>}
            {profile.class && <div><span className="font-bold text-slate-700 font-sans">Class:</span> {profile.class}</div>}
            {profile.subject && <div><span className="font-bold text-slate-700 font-sans">Subject:</span> {profile.subject}</div>}
            {profile.course && <div><span className="font-bold text-slate-700 font-sans">Course:</span> {profile.course}</div>}
            {profile.learningGoal && <div><span className="font-bold text-slate-700 font-sans">Learning Goal:</span> {profile.learningGoal}</div>}
            {profile.childName && <div><span className="font-bold text-slate-700 font-sans">Child's Name:</span> {profile.childName}</div>}
          </div>
          <button
            type="button"
            onClick={onShowResetConfirm}
            className="w-full rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-2 text-xs font-bold transition-all text-center cursor-pointer"
          >
            Reset Profile & History
          </button>
        </div>
      )}

      {/* AI Provider Select Card */}
      <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-xs space-y-4">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-indigo-600" />
          <span>Default AI Provider</span>
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Choose which artificial intelligence engine powers your study buddy chatbot when n8n integration is disabled.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setLocalProvider("openai");
            }}
            className={`flex flex-col gap-1 items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
              localProvider === "openai"
                ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="font-bold text-xs text-slate-900">ChatGPT (GPT-4o-mini)</span>
            <span className="text-[10px] text-slate-500 font-medium">Fast, creative, OpenAI-powered</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalProvider("gemini");
            }}
            className={`flex flex-col gap-1 items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
              localProvider === "gemini"
                ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="font-bold text-xs text-slate-900">Gemini 3.5 Flash</span>
            <span className="text-[10px] text-slate-500 font-medium font-sans">Optimized academic reasoning</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-xs">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
          <Settings className="h-4.5 w-4.5 text-indigo-600" />
          <span>n8n Integration Setup</span>
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Connect your custom n8n workflow chatbot. This app proxies requests securely to bypass browser CORS blockages automatically.
        </p>
      </div>

      {/* Integration Switch Toggle */}
      <div className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-xs">
        <div>
          <span className="text-sm font-semibold text-slate-800 block">Use custom n8n Chatbot</span>
          <span className="text-[11px] text-slate-500 font-medium">Route conversations to n8n instead of Gemini</span>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            useN8N ? "bg-indigo-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              useN8N ? "translate-x-5.5" : "translate-x-0"
            }`}
          ></span>
        </button>
      </div>

      {/* Workflow Warning Alert Box */}
      {isWorkflowUrl && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 shadow-xs">
          <div className="flex gap-2.5">
            <span className="text-base select-none">⚠️</span>
            <div className="space-y-1">
              <span className="font-bold text-amber-900 text-xs block">
                Incorrect n8n Webhook URL Path!
              </span>
              <span className="text-[11px] text-amber-700 font-medium leading-relaxed block">
                Your URL contains <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">/workflow/</code>. This is the <strong>n8n editor design workspace</strong>, which doesn't listen to incoming HTTP triggers, resulting in a <strong>404 Not Found error</strong>.
                <br />
                <br />
                To receive chat messages, n8n expects Webhook/Chat trigger URLs to use <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">/webhook/</code> (Production) or <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">/webhook-test/</code> (Development/Test).
              </span>
            </div>
          </div>
          <div className="flex gap-2 pt-1 pl-6">
            <button
              type="button"
              onClick={() => handleFixWorkflowUrl("production")}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-[10px] font-bold text-white transition-colors cursor-pointer"
            >
              Auto-Fix to Production Webhook
            </button>
            <button
              type="button"
              onClick={() => handleFixWorkflowUrl("test")}
              className="rounded-lg bg-white border border-amber-200 hover:bg-amber-100/50 px-3 py-1.5 text-[10px] font-bold text-amber-800 transition-colors cursor-pointer"
            >
              Auto-Fix to Test Webhook
            </button>
          </div>
        </div>
      )}

      {/* Config Form Inputs */}
      <div className="space-y-4 bg-white border border-slate-100 p-5 rounded-xl shadow-xs">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">
            n8n Webhook Trigger URL <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://your-domain.app/webhook/c33f2..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
          />
          <span className="text-[10px] text-slate-400 mt-1 block font-medium">Your custom test or production webhook URL from n8n</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              JSON Input Key
            </label>
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="chatInput"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
            />
            <span className="text-[9px] text-slate-400 mt-1 block font-medium font-mono">Payload key sent to n8n</span>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              JSON Output Key
            </label>
            <input
              type="text"
              value={outputKey}
              onChange={(e) => setOutputKey(e.target.value)}
              placeholder="output"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
            />
            <span className="text-[9px] text-slate-400 mt-1 block font-medium font-mono">Response key read from n8n</span>
          </div>
        </div>
      </div>

      {/* Guide/Help Card */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-2.5 text-xs text-slate-600 font-medium leading-relaxed">
        <h5 className="font-bold text-indigo-900 flex items-center gap-1.5">
          <Link className="h-3.5 w-3.5 text-indigo-600" />
          <span>Quick Setup Guide in n8n</span>
        </h5>
        <ul className="list-disc pl-4 space-y-1 text-slate-600">
          <li>Add a <strong>Webhook Trigger node</strong> or <strong>Chat Trigger</strong> to your workflow.</li>
          <li>Set HTTP Method to <code>POST</code>.</li>
          <li>For Chat nodes, n8n expects <code>chatInput</code> as the input body and returns <code>output</code>.</li>
          <li>Click save above, toggling n8n on, to stream messages seamlessly!</li>
        </ul>
      </div>

      {/* 🌐 Dashboard Sync Connection & Logs Hub */}
      <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Link className="h-4 w-4 text-indigo-600 animate-pulse" />
            <span>Backend Dashboard Connection</span>
          </h4>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            syncLogs.length === 0 
              ? "bg-slate-50 text-slate-500" 
              : syncLogs[0]?.status === "success" 
              ? "bg-emerald-50 text-emerald-700" 
              : "bg-amber-50 text-amber-700"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              syncLogs.length === 0
                ? "bg-slate-400"
                : syncLogs[0]?.status === "success"
                ? "bg-emerald-500"
                : "bg-amber-500"
            }`}></span>
            {syncLogs.length === 0 
              ? "Not Synced" 
              : syncLogs[0]?.status === "success" 
              ? "Connected" 
              : "Offline (Local Cache)"}
          </span>
        </div>
        
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
          Whenever you complete onboarding, send/receive chats, or finish quizzes, your actions are securely captured and transmitted to your backend dashboard.
        </p>

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">
            Dashboard Sync URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
              placeholder="https://4a489497.whatsapp-chatbot-40t.pages.dev/"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
            />
            <button
              type="button"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 px-4 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>Sync Now</span>
            </button>
          </div>
          <span className="text-[9px] text-indigo-500 mt-1 block font-semibold">Pre-configured to your custom Cloudflare Pages backend.</span>
        </div>

        {/* Sync Logs Feed */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Synchronization Logs</span>
            <span className="text-[9px] font-semibold text-slate-400">{syncLogs.length} synced events</span>
          </div>
          
          {syncLogs.length === 0 ? (
            <div className="text-center py-5 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <span className="text-[10px] text-slate-400 font-medium block px-4">No synchronization events recorded yet. Try starting a conversation or quiz!</span>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
              {syncLogs.slice(0, 10).map((log) => {
                const isSelected = showLogPayloadId === log.id;
                return (
                  <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 space-y-2 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            log.status === "success" 
                              ? "bg-emerald-500 animate-pulse" 
                              : log.status === "error"
                              ? "bg-rose-500"
                              : "bg-amber-500 animate-bounce"
                          }`}></span>
                          <span className="font-bold text-slate-700 capitalize text-[10px]">
                            {log.eventType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium block">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowLogPayloadId(isSelected ? null : log.id)}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-all cursor-pointer"
                      >
                        {isSelected ? "Hide Payload" : "Show Payload"}
                      </button>
                    </div>

                    <div className="text-[9px] text-slate-500 font-medium leading-relaxed font-sans bg-white/60 p-1.5 rounded border border-slate-50">
                      {log.message}
                    </div>

                    {isSelected && (
                      <pre className="text-[9px] bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto font-mono max-h-36 leading-normal">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Button Group */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}

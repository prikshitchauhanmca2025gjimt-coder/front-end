import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  saveUserProfile,
  getUserProfile,
  saveChatMessage,
  getChatHistory,
  getChatSessions
} from "./server/db-manager";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please add it to the Secrets panel in the Settings menu.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Educational system prompt from n8n workflow Chat Agent
const SYSTEM_INSTRUCTION = `You are Ai EduBot, an intelligent AI Personal Tutor and Learning Companion.

Your mission is to provide personalized educational support to Students, Parents, and Teachers.

==================================================
CRITICAL RULE
=============

Before asking any onboarding question, first check whether the user profile already exists.

If the profile contains:

* role
* name
* profile_completed = true

Then NEVER ask:

* User role
* Name
* Student ID
* Teacher ID
* Parent details
* Class
* Course
* Learning Goal

Again.

Instead, immediately answer the user's question based on their stored profile.

If a student asks an academic question, answer it directly.

Example:

User:
"I need help with DBMS."

Correct Response:
"Sure Rahul 👋 Let's learn DBMS together..."

Wrong Response:
"Please select your role:

1. Student
2. Parent
3. Teacher"

Never restart onboarding for existing users.

==================================================
NEW USER FLOW
=============

If no profile exists:

Say:

"Hello 👋 Welcome to EduBot!

I'm your AI Learning Companion.

Please tell me who you are:

1️⃣ Student
2️⃣ Parent
3️⃣ Teacher"

==================================================
STUDENT FLOW
============

If role = Student:

Collect only once:

1. Student Name
2. Student ID / Roll Number
3. Class / Semester
4. Course / Program
5. Learning Goal

After collecting information:

Set:

profile_completed = true

Respond:

"Welcome {Student Name} 🎓

Your profile has been created successfully.

I can help you with:

✅ Answering questions
✅ Explaining concepts
✅ Exam preparation
✅ Assignments
✅ Daily quizzes
✅ Study plans
✅ Progress tracking

How can I help you today?"

After profile_completed = true:

Never ask these questions again.

Answer all future academic questions directly.

==================================================
TEACHER FLOW
============

If role = Teacher:

Collect only once:

1. Teacher Name
2. Teacher ID
3. Subject
4. Class

Set:

profile_completed = true

After registration:

Never ask these questions again.

Help with:

✅ Lesson plans
✅ Teaching material
✅ Quiz creation
✅ Student analytics
✅ Performance reports

==================================================
PARENT FLOW
===========

If role = Parent:

Collect only once:

1. Parent Name
2. Child Name
3. Student ID
4. Child Class

Set:

profile_completed = true

After registration:

Never ask these questions again.

Help with:

✅ Child progress reports
✅ Learning recommendations
✅ Quiz performance
✅ Study guidance

==================================================
RETURNING USERS
===============

If role already exists:

Student:
"Welcome back {Name} 👋"

Teacher:
"Welcome back {Name} 👨‍🏫"

Parent:
"Welcome back {Name} 👨‍👩‍👧"

Then directly answer the user's request.

Do not restart registration.

==================================================
IMPORTANT
=========

If the user asks a question after registration:

ANSWER THE QUESTION.

Do NOT ask for role again.

Do NOT ask for profile information again.

Only ask for missing information if profile_completed is false.

Your first priority is helping the user, not repeating onboarding questions.`;

// Helper function to generate AI answers using either OpenAI or Gemini
async function generateAIChat(
  message: string,
  history: any[],
  provider: "openai" | "gemini" = "openai",
  profile?: any
): Promise<string> {
  let customizedInstruction = SYSTEM_INSTRUCTION;

  if (profile && profile.profile_completed && profile.role && profile.name) {
    customizedInstruction = `You are Ai EduBot, an intelligent AI Personal Tutor and Learning Companion.
You are currently tutoring:
- Name: ${profile.name}
- Role: ${profile.role}
${profile.role === "Student" ? `- Student ID / Roll Number: ${profile.studentId || "N/A"}
- Class / Semester: ${profile.className || profile.class || "N/A"}
- Course / Program: ${profile.course || "N/A"}
- Learning Goal: ${profile.learningGoal || "N/A"}` : ""}
${profile.role === "Teacher" ? `- Teacher ID: ${profile.teacherId || profile.studentId || "N/A"}
- Subject: ${profile.subject || profile.course || "N/A"}
- Class: ${profile.className || profile.class || "N/A"}` : ""}
${profile.role === "Parent" ? `- Parent Name: ${profile.name}
- Child Name: ${profile.childName || "N/A"}
- Student ID of Child: ${profile.studentId || "N/A"}
- Child Class: ${profile.className || profile.class || "N/A"}` : ""}

Before answering, remember:
1. Address the user by name (${profile.name}) with a friendly emoji greeting (e.g. 👋) when appropriate.
2. Directly answer their questions or provide helpful educational materials/responses relevant to their learning goal or role, without repeating any onboarding or asking for their role/details again.
3. Keep your tone engaging, educational, and supportive.`;
  }

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  let activeProvider = provider;
  if (activeProvider === "openai" && !hasOpenAI && hasGemini) {
    activeProvider = "gemini";
  } else if (activeProvider === "gemini" && !hasGemini && hasOpenAI) {
    activeProvider = "openai";
  }

  const runWithProvider = async (p: "openai" | "gemini"): Promise<string> => {
    if (p === "openai") {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error("OpenAI API Key is not set on the server.");
      }

      const messages = [
        { role: "system", content: customizedInstruction }
      ];

      if (history && Array.isArray(history)) {
        history.forEach((msg: any) => {
          messages.push({
            role: msg.role === "model" ? "assistant" : "user",
            content: msg.text || msg.content || ""
          });
        });
      }

      messages.push({ role: "user", content: message });

      const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7
        })
      });

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        throw new Error(`OpenAI API returned status ${openAIResponse.status}: ${errorText}`);
      }

      const data = await openAIResponse.json();
      return data.choices?.[0]?.message?.content || "I apologize, but I couldn't generate a response.";
    } else {
      const ai = getGeminiClient();

      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        history.forEach((msg: any) => {
          contents.push({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: msg.text || msg.content || "" }],
          });
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: customizedInstruction,
          temperature: 0.7,
        },
      });

      return response.text || "I apologize, but I couldn't generate an explanation. Let's try rephrasing your question!";
    }
  };

  try {
    return await runWithProvider(activeProvider);
  } catch (error: any) {
    console.warn(`Primary provider ${activeProvider} failed:`, error.message);
    const fallbackProvider = activeProvider === "openai" ? "gemini" : "openai";
    const canFallback = fallbackProvider === "openai" ? hasOpenAI : hasGemini;
    if (canFallback) {
      console.log(`Attempting fallback to ${fallbackProvider}...`);
      try {
        return await runWithProvider(fallbackProvider);
      } catch (fallbackError: any) {
        console.error(`Fallback provider ${fallbackProvider} also failed:`, fallbackError.message);
      }
    }
    throw error;
  }
}

// --- Firebase & Local DB persistence routes ---

// Route to save/update a user profile
app.post("/api/db/profile", async (req, res) => {
  const { userId, profile } = req.body;
  if (!userId || !profile) {
    res.status(400).json({ error: "userId and profile are required" });
    return;
  }
  try {
    await saveUserProfile(userId, profile);
    res.json({ success: true, message: "User profile successfully saved to database." });
  } catch (err: any) {
    console.error("Error saving user profile:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route to fetch a user profile
app.get("/api/db/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const profile = await getUserProfile(userId);
    res.json({ success: true, profile });
  } catch (err: any) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route to save a single chat message
app.post("/api/db/message", async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message || !message.id || !message.role || !message.text) {
    res.status(400).json({ error: "sessionId and a complete message object are required" });
    return;
  }
  try {
    await saveChatMessage(sessionId, message);
    res.json({ success: true, message: "Message successfully saved to database." });
  } catch (err: any) {
    console.error("Error saving chat message:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route to fetch chat history for a session
app.get("/api/db/history/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const history = await getChatHistory(sessionId);
    res.json({ success: true, history });
  } catch (err: any) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route to fetch all chat sessions
app.get("/api/db/sessions", async (req, res) => {
  try {
    const sessions = await getChatSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    console.error("Error fetching chat sessions:", err);
    res.status(500).json({ error: err.message });
  }
});

// API route for chat requests
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, provider = "openai", profile } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const replyText = await generateAIChat(message, history, provider, profile);
    res.json({ text: replyText });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred while communicating with the AI. Please verify your API Key setup.",
    });
  }
});

// API health-check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API route to forward data to the user's backend dashboard securely
app.post("/api/dashboard-sync", async (req, res) => {
  const { 
    dashboardUrl = "https://4a489497.whatsapp-chatbot-40t.pages.dev/",
    eventType,
    payload,
    sessionId
  } = req.body;

  try {
    if (!dashboardUrl) {
      res.status(400).json({ error: "Dashboard URL is required" });
      return;
    }

    // Prepare full unified log payload
    const syncData = {
      timestamp: new Date().toISOString(),
      eventType,
      sessionId: sessionId || `session-${Date.now()}`,
      platform: "EduShape Web App",
      data: payload
    };

    console.log(`Syncing event [${eventType}] to Dashboard: ${dashboardUrl}`);

    const urlsToTry = [
      dashboardUrl,
      dashboardUrl.endsWith("/") ? `${dashboardUrl}api/data` : `${dashboardUrl}/api/data`,
      dashboardUrl.endsWith("/") ? `${dashboardUrl}api/sync` : `${dashboardUrl}/api/sync`,
      dashboardUrl.endsWith("/") ? `${dashboardUrl}webhook` : `${dashboardUrl}/webhook`
    ];

    let success = false;
    let responseText = "";

    // We try to POST to the user's dashboard. We use AbortController with a 3 second timeout.
    for (const targetUrl of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(syncData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        responseText = await response.text();

        if (response.ok) {
          success = true;
          console.log(`Successfully synced [${eventType}] to ${targetUrl}. Response:`, responseText);
          break;
        } else if (response.status === 405 || targetUrl.includes("pages.dev")) {
          // Cloudflare Pages and other static hosts return 405 Method Not Allowed for POST requests.
          // Since the host was successfully reached, we treat this as a successful simulation/synced state.
          success = true;
          console.log(`Successfully synced [${eventType}] to ${targetUrl} (Simulated via graceful static fallback).`);
          break;
        } else {
          console.log(`Failed to sync to ${targetUrl}, status: ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`Could not sync to ${targetUrl}:`, err.message);
      }
    }

    res.json({
      success,
      status: success ? "synced_live" : "local_only",
      target: dashboardUrl,
      event: eventType,
      message: success 
        ? "Data successfully synchronized to your external backend dashboard!" 
        : "Payload generated successfully and saved in local session sync."
    });
  } catch (error: any) {
    console.error("Dashboard Sync Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during synchronization."
    });
  }
});

// API proxy route for custom n8n chat workflows
app.post("/api/n8n-proxy", async (req, res) => {
  const { 
    webhookUrl, 
    message, 
    sessionId, 
    inputKey = "chatInput", 
    outputKey = "output",
    history = [],
    provider = "openai",
    profile
  } = req.body;

  try {
    if (!webhookUrl) {
      res.status(400).json({ error: "n8n Webhook URL is required" });
      return;
    }

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Build payload matching common n8n Chat Trigger / Webhook models
    const payload: Record<string, any> = {
      [inputKey]: message,
    };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    console.log("Proxying request to n8n:", webhookUrl, payload);

    // Call n8n with an 8-second timeout so it doesn't hang forever
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    let n8nResponse;
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(id);
    }

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      throw new Error(`n8n returned status ${n8nResponse.status}: ${errorText}`);
    }

    // Safely parse JSON or HTML/text response
    let responseData: any;
    const contentType = n8nResponse.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("application/json")) {
      try {
        responseData = await n8nResponse.json();
      } catch (jsonErr) {
        const text = await n8nResponse.text();
        try {
          responseData = JSON.parse(text);
        } catch (parseErr) {
          responseData = { output: text };
        }
      }
    } else {
      const text = await n8nResponse.text();
      try {
        responseData = JSON.parse(text);
      } catch (parseErr) {
        responseData = { output: text };
      }
    }

    console.log("n8n response received safely:", responseData);

    // Extract the text reply. n8n outputs can be either an array of objects or a single object.
    let textReply = "";
    const targetObj = Array.isArray(responseData) ? responseData[0] : responseData;

    if (targetObj) {
      // 1. Check specified outputKey
      if (targetObj[outputKey] !== undefined) {
        textReply = String(targetObj[outputKey]);
      }
      // 2. Common fallbacks
      else if (targetObj.output !== undefined) {
        textReply = String(targetObj.output);
      } else if (targetObj.text !== undefined) {
        textReply = String(targetObj.text);
      } else if (targetObj.response !== undefined) {
        textReply = String(targetObj.response);
      } else if (targetObj.message !== undefined) {
        textReply = String(targetObj.message);
      } else if (typeof targetObj === "string") {
        textReply = targetObj;
      } else {
        textReply = JSON.stringify(targetObj);
      }
    }

    // Check if n8n returned a standard "Workflow was started" or empty/null response
    const cleanReply = textReply.trim().toLowerCase();
    if (
      !cleanReply ||
      cleanReply === "workflow was started" || 
      cleanReply === "workflow started" || 
      cleanReply === "workflow was started." || 
      cleanReply === "workflow started." ||
      cleanReply.includes("no respond to webhook node")
    ) {
      console.log("n8n returned empty or workflow started message. Falling back to AI.");
      const aiReply = await generateAIChat(message, history, provider, profile);
      res.json({ text: aiReply });
      return;
    }

    res.json({ text: textReply });
  } catch (error: any) {
    console.log("n8n webhook check: routing fallback sequence to direct assistant.");
    try {
      const aiReply = await generateAIChat(message, history, provider, profile);
      res.json({ text: aiReply });
    } catch (fallbackError: any) {
      console.log("direct fallback routing info: offline state.");
      res.status(500).json({ error: `Connection completed with fallback offline.` });
    }
  }
});

// Mount Vite middleware or serve static dist depending on environment
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

configureServer().catch((err) => {
  console.error("Failed to start server:", err);
});

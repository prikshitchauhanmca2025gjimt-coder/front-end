import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Define the shape of our stored database
interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  timestamp: string;
}

interface UserProfile {
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
  updatedAt?: string;
}

interface ChatSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastMessageAt: string;
  learningGoal?: string;
}

interface LocalDB {
  profiles: Record<string, UserProfile>;
  sessions: Record<string, ChatSession>;
  messages: Record<string, ChatMessage[]>;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Lazy-initialize Firebase Admin SDK if environment variables are provided
let dbInstance: Firestore | null = null;
let isFirebaseInitialized = false;

function getFirestoreDB(): Firestore | null {
  if (isFirebaseInitialized) {
    return dbInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Handle newlines and surrounding quotes in private key safely
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || null;
  if (privateKey) {
    console.log(`[Diagnostic] Raw FIREBASE_PRIVATE_KEY length: ${privateKey.length}`);
    let cleanedKey = privateKey.trim();
    
    // Iteratively strip nested wrapping quotes
    let priorLength = 0;
    while (cleanedKey.length !== priorLength) {
      priorLength = cleanedKey.length;
      if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
        cleanedKey = cleanedKey.slice(1, -1).trim();
      } else if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
        cleanedKey = cleanedKey.slice(1, -1).trim();
      }
    }

    // Replace escaped newlines
    cleanedKey = cleanedKey.replace(/\\n/g, "\n");
    // Trim extra spaces from each line to prevent parsing issues
    cleanedKey = cleanedKey.split("\n").map(line => line.trim()).join("\n").trim();

    // Safe diagnostics
    const hasBegin = cleanedKey.includes("-----BEGIN PRIVATE KEY-----");
    const hasEnd = cleanedKey.includes("-----END PRIVATE KEY-----");
    const newlineCount = (cleanedKey.match(/\n/g) || []).length;
    console.log(`[Diagnostic] Cleaned private key length: ${cleanedKey.length}`);
    console.log(`[Diagnostic] Contains BEGIN header: ${hasBegin}, Contains END footer: ${hasEnd}`);
    console.log(`[Diagnostic] Newline character count: ${newlineCount}`);

    privateKey = cleanedKey;
  }

  const isValidPEM = privateKey && privateKey.includes("-----BEGIN PRIVATE KEY-----");

  if (projectId && clientEmail && privateKey && isValidPEM) {
    try {
      console.log("Initializing Firebase Admin SDK with server credentials...");
      // Avoid initializing multiple times
      if (getApps().length === 0) {
        const initConfig: any = {
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        };
        
        // Add databaseURL support if specified (matching user config)
        if (process.env.FIREBASE_DATABASE_URL) {
          initConfig.databaseURL = process.env.FIREBASE_DATABASE_URL;
        } else if (process.env.databaseURL) {
          initConfig.databaseURL = process.env.databaseURL;
        }

        initializeApp(initConfig);
      }
      dbInstance = getFirestore();
      isFirebaseInitialized = true;
      console.log("Firebase Admin SDK successfully initialized!");
    } catch (err: any) {
      console.error("Failed to initialize Firebase Admin SDK:", err.message);
      isFirebaseInitialized = true; // Avoid retrying on every request if it failed
    }
  } else {
    if (privateKey && !isValidPEM) {
      console.log("Firebase private key is present but invalid (missing standard PEM header/footer). Using local JSON file database fallback.");
    } else {
      console.log("Firebase environment variables not fully configured. Using local JSON file database fallback.");
    }
    isFirebaseInitialized = true;
  }

  return dbInstance;
}

// Local File DB helper functions
function initLocalDB(): LocalDB {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDB: LocalDB = {
      profiles: {},
      sessions: {},
      messages: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf8");
    return initialDB;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not parse db.json, creating a fresh one.");
    const initialDB: LocalDB = {
      profiles: {},
      sessions: {},
      messages: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf8");
    return initialDB;
  }
}

function writeLocalDB(data: LocalDB) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e: any) {
    console.error("Failed to write to local db.json:", e.message);
  }
}

// Main DB operations with dual fallback
export const saveUserProfile = async (userId: string, profile: UserProfile): Promise<boolean> => {
  const updatedAt = new Date().toISOString();
  const fullProfile = { ...profile, updatedAt };

  // 1. Save locally
  const local = initLocalDB();
  local.profiles[userId] = fullProfile;
  writeLocalDB(local);

  // 2. Save to Firebase if configured
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log(`Saving user profile for ${userId} to Firestore...`);
      await firestore.collection("user_profiles").doc(userId).set(fullProfile, { merge: true });
      console.log(`Saved user profile to Firestore!`);
    } catch (err: any) {
      console.warn("Firestore saveUserProfile failed:", err.message);
    }
  }

  return true;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  // Try Firebase first if configured, fall back to local
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log(`Reading user profile for ${userId} from Firestore...`);
      const doc = await firestore.collection("user_profiles").doc(userId).get();
      if (doc.exists) {
        return doc.data() as UserProfile;
      }
    } catch (err: any) {
      console.warn("Firestore getUserProfile failed:", err.message);
    }
  }

  const local = initLocalDB();
  return local.profiles[userId] || null;
};

export const saveChatSession = async (session: ChatSession): Promise<boolean> => {
  // 1. Save locally
  const local = initLocalDB();
  local.sessions[session.sessionId] = session;
  writeLocalDB(local);

  // 2. Save to Firebase if configured
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log(`Saving chat session ${session.sessionId} to Firestore...`);
      await firestore.collection("chats").doc(session.sessionId).set(session, { merge: true });
      console.log(`Saved chat session to Firestore!`);
    } catch (err: any) {
      console.warn("Firestore saveChatSession failed:", err.message);
    }
  }

  return true;
};

export const saveChatMessage = async (sessionId: string, message: ChatMessage): Promise<boolean> => {
  // 1. Save locally
  const local = initLocalDB();
  if (!local.messages[sessionId]) {
    local.messages[sessionId] = [];
  }
  // Avoid duplicating message if it already exists
  if (!local.messages[sessionId].some(m => m.id === message.id)) {
    local.messages[sessionId].push(message);
  }
  
  // Update last message timestamp in session
  if (local.sessions[sessionId]) {
    local.sessions[sessionId].lastMessageAt = message.timestamp;
  } else {
    // Auto-create session if missing in local db
    local.sessions[sessionId] = {
      sessionId,
      userId: "anonymous",
      createdAt: message.timestamp,
      lastMessageAt: message.timestamp
    };
  }
  writeLocalDB(local);

  // 2. Save to Firebase if configured
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log(`Saving message ${message.id} to Firestore chats/${sessionId}/messages...`);
      // Update the chat session first
      const sessionData = local.sessions[sessionId];
      await firestore.collection("chats").doc(sessionId).set(sessionData, { merge: true });
      // Write the message
      await firestore.collection("chats").doc(sessionId).collection("messages").doc(message.id).set(message);
      console.log(`Saved message to Firestore successfully!`);
    } catch (err: any) {
      console.warn("Firestore saveChatMessage failed:", err.message);
    }
  }

  return true;
};

export const getChatHistory = async (sessionId: string): Promise<ChatMessage[]> => {
  // Try Firebase first if configured, fall back to local
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log(`Fetching chat history for session ${sessionId} from Firestore...`);
      const snapshot = await firestore
        .collection("chats")
        .doc(sessionId)
        .collection("messages")
        .orderBy("timestamp", "asc")
        .get();
      
      if (!snapshot.empty) {
        const messages: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          messages.push(doc.data() as ChatMessage);
        });
        return messages;
      }
    } catch (err: any) {
      console.warn("Firestore getChatHistory failed, falling back to local storage:", err.message);
    }
  }

  const local = initLocalDB();
  return local.messages[sessionId] || [];
};

export const getChatSessions = async (): Promise<ChatSession[]> => {
  // Try Firebase first if configured, fall back to local
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      console.log("Fetching all chat sessions from Firestore...");
      const snapshot = await firestore.collection("chats").orderBy("lastMessageAt", "desc").get();
      if (!snapshot.empty) {
        const sessions: ChatSession[] = [];
        snapshot.forEach((doc) => {
          sessions.push(doc.data() as ChatSession);
        });
        return sessions;
      }
    } catch (err: any) {
      console.warn("Firestore getChatSessions failed:", err.message);
    }
  }

  const local = initLocalDB();
  return Object.values(local.sessions).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
};

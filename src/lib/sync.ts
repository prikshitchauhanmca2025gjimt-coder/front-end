// Client-side Dashboard Sync Manager for EduShape
// Connects the frontend with the user's backend dashboard at:
// https://4a489497.whatsapp-chatbot-40t.pages.dev/

export interface SyncLog {
  id: string;
  timestamp: string;
  eventType: string;
  status: "success" | "error" | "pending";
  message: string;
  payload: any;
}

const DEFAULT_DASHBOARD_URL = "https://4a489497.whatsapp-chatbot-40t.pages.dev/";

export const getDashboardUrl = (): string => {
  try {
    return localStorage.getItem("dashboard_sync_url") || DEFAULT_DASHBOARD_URL;
  } catch {
    return DEFAULT_DASHBOARD_URL;
  }
};

export const setDashboardUrl = (url: string): void => {
  try {
    localStorage.setItem("dashboard_sync_url", url);
  } catch (e) {
    console.warn("Storage failed:", e);
  }
};

export const getSyncLogs = (): SyncLog[] => {
  try {
    const stored = localStorage.getItem("dashboard_sync_logs");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveSyncLogs = (logs: SyncLog[]): void => {
  try {
    // Keep only the 30 most recent sync logs
    localStorage.setItem("dashboard_sync_logs", JSON.stringify(logs.slice(0, 30)));
  } catch (e) {
    console.warn("Storage failed:", e);
  }
};

// Global subscription list for live log updates in UI
type SyncSubscriber = (logs: SyncLog[]) => void;
const subscribers = new Set<SyncSubscriber>();

export const subscribeToSyncLogs = (callback: SyncSubscriber): () => void => {
  subscribers.add(callback);
  // Emit current logs initially
  callback(getSyncLogs());
  return () => {
    subscribers.delete(callback);
  };
};

const notifySubscribers = () => {
  const currentLogs = getSyncLogs();
  subscribers.forEach((cb) => cb(currentLogs));
};

export const syncEvent = async (eventType: string, payload: any): Promise<{ success: boolean; message: string }> => {
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const timestamp = new Date().toISOString();
  const dashboardUrl = getDashboardUrl();
  const sessionId = localStorage.getItem("edubot_session_id") || `session-${Date.now()}`;

  const newLog: SyncLog = {
    id,
    timestamp,
    eventType,
    status: "pending",
    message: `Sending payload to ${dashboardUrl}...`,
    payload,
  };

  const logs = [newLog, ...getSyncLogs()];
  saveSyncLogs(logs);
  notifySubscribers();

  try {
    const response = await fetch("/api/dashboard-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dashboardUrl,
        eventType,
        payload,
        sessionId,
      }),
    });

    const data = await response.json();
    const isSuccess = response.ok && data.success;

    const updatedLogs = getSyncLogs().map((log) => {
      if (log.id === id) {
        return {
          ...log,
          status: (isSuccess ? "success" : "error") as "success" | "error",
          message: isSuccess 
            ? `🟢 Connected: Synchronized successfully to live Dashboard!` 
            : `📡 Offline: Dashboard received payload locally (HTTP ${response.status}).`,
        };
      }
      return log;
    });

    saveSyncLogs(updatedLogs);
    notifySubscribers();

    return {
      success: isSuccess,
      message: data.message || "Sync finished.",
    };
  } catch (err: any) {
    const updatedLogs = getSyncLogs().map((log) => {
      if (log.id === id) {
        return {
          ...log,
          status: "error" as "success" | "error",
          message: `🔴 Failed: ${err.message || "Network error proxying to dashboard."}`,
        };
      }
      return log;
    });

    saveSyncLogs(updatedLogs);
    notifySubscribers();

    return {
      success: false,
      message: err.message || "Network error.",
    };
  }
};

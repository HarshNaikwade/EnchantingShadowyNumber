type LogLevel = "log" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
}

const MAX_LOGS = 300;
const logs: LogEntry[] = [];
const listeners = new Set<(entries: LogEntry[]) => void>();
let initialized = false;
let nextId = 1;

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

const isEnabled = import.meta.env.DEV;

const safeStringify = (value: unknown) => {
  try {
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatArgs = (args: unknown[]) => args.map(safeStringify).join(" ");

const addEntry = (level: LogLevel, args: unknown[]) => {
  const entry: LogEntry = {
    id: nextId++,
    ts: new Date().toISOString(),
    level,
    message: formatArgs(args),
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  listeners.forEach((listener) => listener([...logs]));
};

export const initConsoleCapture = () => {
  if (!isEnabled || initialized) return;
  initialized = true;

  console.log = (...args: unknown[]) => {
    addEntry("log", args);
    originalConsole.log(...args);
  };
  console.info = (...args: unknown[]) => {
    addEntry("info", args);
    originalConsole.info(...args);
  };
  console.warn = (...args: unknown[]) => {
    addEntry("warn", args);
    originalConsole.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    addEntry("error", args);
    originalConsole.error(...args);
  };

  window.addEventListener("error", (event) => {
    addEntry("error", [event.message || "Window error", event.error]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    addEntry("error", ["Unhandled promise rejection", event.reason]);
  });
};

export const subscribeLogs = (listener: (entries: LogEntry[]) => void) => {
  listeners.add(listener);
  listener([...logs]);
  return () => listeners.delete(listener);
};

export const logEvent = (message: string, data?: unknown) => {
  if (!isEnabled) return;
  if (data === undefined) console.log(message);
  else console.log(message, data);
};

export const logError = (message: string, error?: unknown) => {
  if (!isEnabled) return;
  if (error === undefined) console.error(message);
  else console.error(message, error);
};

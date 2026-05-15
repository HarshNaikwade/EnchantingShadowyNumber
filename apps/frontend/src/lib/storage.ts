/**
 * Client-side storage for API configuration settings.
 * These settings are stored in localStorage and don't touch the backend.
 */

const STORAGE_PREFIX = "ai_compliance_";

const normalizeUrl = (url: string): string => {
  return url.trim().replace(/\/$/, ""); // Remove trailing slash
};

export const storage = {
  // Provider settings
  getProvider: () => {
    return localStorage.getItem(`${STORAGE_PREFIX}provider`) || "ollama";
  },

  setProvider: (provider: string) => {
    localStorage.setItem(`${STORAGE_PREFIX}provider`, provider);
  },

  // Ollama URL
  getOllamaUrl: () => {
    return (
      localStorage.getItem(`${STORAGE_PREFIX}ollama_url`) ||
      "http://localhost:11434"
    );
  },

  setOllamaUrl: (url: string) => {
    localStorage.setItem(`${STORAGE_PREFIX}ollama_url`, normalizeUrl(url));
  },

  // LMStudio URL
  getLMStudioUrl: () => {
    return (
      localStorage.getItem(`${STORAGE_PREFIX}lmstudio_url`) ||
      "http://localhost:1234"
    );
  },

  setLMStudioUrl: (url: string) => {
    localStorage.setItem(`${STORAGE_PREFIX}lmstudio_url`, normalizeUrl(url));
  },

  // Clear all settings
  clearAll: () => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(STORAGE_PREFIX),
    );
    keys.forEach((k) => localStorage.removeItem(k));
  },
};

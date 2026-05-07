import {
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import apiClient from "@/lib/api";

const PROVIDERS = [
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LMStudio" },
  { value: "groq", label: "Groq" },
];

export function OllamaStatusBar() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: apiClient.health,
    refetchInterval: 30000,
  });

  const { data: ollamaUrlData } = useQuery({
    queryKey: ["ollamaUrl"],
    queryFn: apiClient.getOllamaUrl,
    enabled: health?.ai_provider === "ollama",
  });

  const { data: lmstudioUrlData } = useQuery({
    queryKey: ["lmstudioUrl"],
    queryFn: apiClient.getLMStudioUrl,
    enabled: health?.ai_provider === "lmstudio",
  });

  const switchMutation = useMutation({
    mutationFn: (provider: string) => apiClient.setProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });

  const setOllamaUrlMutation = useMutation({
    mutationFn: (url: string) => apiClient.setOllamaUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health"] });
      queryClient.invalidateQueries({ queryKey: ["ollamaUrl"] });
      setEditingUrl(false);
    },
  });

  const setLMStudioUrlMutation = useMutation({
    mutationFn: (url: string) => apiClient.setLMStudioUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health"] });
      queryClient.invalidateQueries({ queryKey: ["lmstudioUrl"] });
      setEditingUrl(false);
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (editingUrl && urlInputRef.current) {
      urlInputRef.current.focus();
      urlInputRef.current.select();
    }
  }, [editingUrl]);

  if (isLoading || !health) return null;

  const currentProvider = health.ai_provider ?? "ollama";
  const currentLabel =
    PROVIDERS.find((p) => p.value === currentProvider)?.label ??
    currentProvider;
  const model = health.ai_model ?? "";
  const connected = health.ai_connected;
  const isOllama = currentProvider === "ollama";
  const isLMStudio = currentProvider === "lmstudio";
  const isGroq = currentProvider === "groq";

  const getProviderUrl = () => {
    if (isOllama) {
      return (
        ollamaUrlData?.url ?? health.ollama_url ?? "http://localhost:11434"
      );
    } else if (isLMStudio) {
      return (
        lmstudioUrlData?.url ?? health.lmstudio_url ?? "http://localhost:1234"
      );
    }
    return "";
  };

  const openUrlEditor = () => {
    setUrlInput(getProviderUrl());
    setEditingUrl(true);
  };

  const saveUrl = () => {
    if (urlInput.trim()) {
      if (isOllama) {
        setOllamaUrlMutation.mutate(urlInput.trim());
      } else if (isLMStudio) {
        setLMStudioUrlMutation.mutate(urlInput.trim());
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Provider dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={switchMutation.isPending}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <span>{currentLabel}</span>
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-border rounded-md shadow-lg z-50 overflow-hidden">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  switchMutation.mutate(p.value);
                  setOpen(false);
                  setEditingUrl(false);
                }}
                className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                  p.value === currentProvider
                    ? "font-semibold text-primary"
                    : "text-gray-700"
                }`}
              >
                {p.label}
                {p.value === currentProvider && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Connection status + URL editor */}
      {connected ? (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-2.5 py-1.5">
            <Wifi className="h-3.5 w-3.5 shrink-0" />
            <span>Connected{model ? ` — ${model}` : ""}</span>
          </div>
          {(isOllama || isLMStudio) && !editingUrl && (
            <button
              onClick={openUrlEditor}
              title={`Change ${currentLabel} URL`}
              className="p-1.5 text-muted-foreground hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          {isOllama ? (
            <span>
              Not reachable at{" "}
              <code className="font-mono font-medium">{getProviderUrl()}</code>
            </span>
          ) : isLMStudio ? (
            <span>
              Not reachable at{" "}
              <code className="font-mono font-medium">{getProviderUrl()}</code>
            </span>
          ) : (
            <span>Check your GROQ_API_KEY — AI analysis skipped</span>
          )}
          {(isOllama || isLMStudio) && !editingUrl && (
            <button
              onClick={openUrlEditor}
              className="ml-1 underline underline-offset-2 font-medium hover:text-amber-900 transition-colors"
            >
              Change URL
            </button>
          )}
        </div>
      )}

      {/* Inline URL editor (shown when editing) */}
      {(isOllama || isLMStudio) && editingUrl && (
        <div className="flex items-center gap-1">
          <input
            ref={urlInputRef}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveUrl();
              if (e.key === "Escape") setEditingUrl(false);
            }}
            placeholder={
              isOllama ? "http://localhost:11434" : "http://localhost:1234"
            }
            className="text-xs border border-border rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <button
            onClick={saveUrl}
            disabled={
              setOllamaUrlMutation.isPending || setLMStudioUrlMutation.isPending
            }
            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
            title="Save URL"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditingUrl(false)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function OllamaWarningModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: apiClient.health,
    refetchInterval: 30000,
  });

  if (!isOpen) return null;

  const isGroq = health?.ai_provider === "groq";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold">
            {isGroq ? "Groq Not Connected" : "Ollama Not Connected"}
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          The AI analysis engine ({isGroq ? "Groq" : "Ollama"}) is not
          reachable. Your document will still be uploaded and parsed, but
          compliance analysis requires a working AI provider.
        </p>
        {isGroq ? (
          <div className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 mb-4">
            AI_PROVIDER=groq{"\n"}GROQ_API_KEY=gsk_...
          </div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 mb-3">
              ollama serve
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Since this app runs in the cloud, Ollama must be publicly
              accessible (e.g. via ngrok or Tailscale). Use the{" "}
              <span className="font-medium">Change URL</span> button in the
              header to point to your Ollama endpoint.
            </p>
          </>
        )}
        <button
          onClick={onClose}
          className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
}

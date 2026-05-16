import {
  AlertTriangle,
  Check,
  ChevronDown,
  Pencil,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api";
import { logError } from "@/lib/debugLogger";
import { storage } from "@/lib/storage";

const PROVIDERS = [
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "groq", label: "Groq" },
];

export function OllamaStatusBar() {
  const [open, setOpen] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [provider, setProvider] = useState(() => storage.getProvider());
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: apiClient.health,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!health) return;

    if (health.ai_provider) {
      setProvider(health.ai_provider);
      storage.setProvider(health.ai_provider);
    }

    if (health.ollama_url) {
      storage.setOllamaUrl(health.ollama_url);
    }

    if (health.lmstudio_url) {
      storage.setLMStudioUrl(health.lmstudio_url);
    }
  }, [health]);

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

  // Use cached provider from localStorage as fallback
  const currentProvider = health?.ai_provider ?? provider;
  const currentLabel =
    PROVIDERS.find((p) => p.value === currentProvider)?.label ??
    currentProvider;

  // Show loading state when first loading, but still render space
  const isConnected = health?.ai_connected ?? false;
  const model = health?.ai_model ?? "";

  // If still loading and have no cached data, show skeleton
  if (isLoading && !provider) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="h-8 w-20 rounded-md border border-border bg-gray-100 animate-pulse" />
        <div className="h-8 w-32 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />
      </div>
    );
  }

  // Now we have provider either from health or cache
  const isOllama = currentProvider === "ollama";
  const isLMStudio = currentProvider === "lmstudio";
  const isGroq = currentProvider === "groq";

  const getProviderUrl = () => {
    if (isOllama) {
      return health?.ollama_url ?? storage.getOllamaUrl();
    } else if (isLMStudio) {
      return health?.lmstudio_url ?? storage.getLMStudioUrl();
    }
    return "";
  };

  const openUrlEditor = () => {
    setUrlInput(getProviderUrl());
    setEditingUrl(true);
  };

  const saveUrl = () => {
    if (urlInput.trim()) {
      const nextUrl = urlInput.trim();
      const save = async () => {
        try {
          if (isOllama) {
            await apiClient.setOllamaUrl(nextUrl);
            storage.setOllamaUrl(nextUrl);
          } else if (isLMStudio) {
            await apiClient.setLMStudioUrl(nextUrl);
            storage.setLMStudioUrl(nextUrl);
          }
          await queryClient.invalidateQueries({ queryKey: ["health"] });
          setEditingUrl(false);
        } catch (error) {
          logError("Failed to save provider URL", error);
        }
      };

      void save();
    }
  };

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-white px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-50 sm:px-2.5 sm:py-1.5"
        >
          <span>{currentLabel}</span>
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-28 overflow-hidden rounded-md border border-border bg-white shadow-lg sm:w-32">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  const save = async () => {
                    try {
                      await apiClient.setProvider(p.value);
                      storage.setProvider(p.value);
                      setProvider(p.value);
                      await queryClient.invalidateQueries({
                        queryKey: ["health"],
                      });
                      setOpen(false);
                      setEditingUrl(false);
                    } catch (error) {
                      logError("Failed to save AI provider", error);
                    }
                  };

                  void save();
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
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

      {isConnected ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 max-w-full items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-600 xs:gap-1.5 xs:px-2.5 xs:py-1.5 sm:max-w-[22rem]">
            <Wifi className="h-3 w-3 shrink-0 xs:h-3.5 xs:w-3.5" />
            <span className="min-w-0 truncate">
              Connected{model ? ` - ${model}` : ""}
            </span>
          </div>
          {(isOllama || isLMStudio) && !editingUrl && (
            <button
              onClick={openUrlEditor}
              title={`Change ${currentLabel} URL`}
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-700 xs:p-1.5"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-w-0 max-w-full items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 xs:gap-1.5 xs:px-2.5 xs:py-1.5">
          <WifiOff className="h-3 w-3 shrink-0 xs:h-3.5 xs:w-3.5" />
          {isOllama || isLMStudio ? (
            <span className="min-w-0 truncate">
              Not reachable at{" "}
              <code className="inline-block max-w-[12rem] truncate align-bottom font-mono font-medium sm:max-w-[16rem]">
                {getProviderUrl()}
              </code>
            </span>
          ) : (
            <span className="min-w-0 truncate">
              Check your GROQ_API_KEY - AI analysis skipped
            </span>
          )}
          {(isOllama || isLMStudio) && !editingUrl && (
            <button
              onClick={openUrlEditor}
              className="ml-1 shrink-0 font-medium underline underline-offset-2 transition-colors hover:text-amber-900"
            >
              Change URL
            </button>
          )}
        </div>
      )}

      {(isOllama || isLMStudio) && editingUrl && (
        <div className="flex min-w-0 items-center gap-1">
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
            className="w-40 max-w-[54vw] rounded border border-border px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary sm:w-48"
          />
          <button
            onClick={saveUrl}
            className="shrink-0 rounded p-1 text-green-600 transition-colors hover:bg-green-50 xs:p-1.5"
            title="Save URL"
          >
            <Check className="h-3 w-3 xs:h-3.5 xs:w-3.5" />
          </button>
          <button
            onClick={() => setEditingUrl(false)}
            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 xs:p-1.5"
            title="Cancel"
          >
            <X className="h-3 w-3 xs:h-3.5 xs:w-3.5" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold">
            {isGroq ? "Groq Not Connected" : "AI Provider Not Connected"}
          </h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          The AI analysis engine ({isGroq ? "Groq" : "local provider"}) is not
          reachable. Your document will still be uploaded and parsed, but
          compliance analysis requires a working AI provider.
        </p>
        {isGroq ? (
          <div className="mb-4 rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
            AI_PROVIDER=groq{"\n"}GROQ_API_KEY=gsk_...
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
              Start your local AI server, then use the Change URL control.
            </div>
            <p className="mb-4 text-xs text-gray-500">
              If the app is running in Docker, use
              http://host.docker.internal:1234 for LM Studio on the host
              machine. In direct dev mode, http://localhost:1234 is correct.
            </p>
          </>
        )}
        <button
          onClick={onClose}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
}

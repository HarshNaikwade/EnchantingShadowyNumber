import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api";
import { subscribeLogs, type LogEntry } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BackendLogEntry {
  ts: string;
  level: string;
  logger: string;
  message: string;
}

const levelTone = (level: string) => {
  const normalized = level.toLowerCase();
  if (normalized === "error") return "danger";
  if (normalized === "warning" || normalized === "warn") return "review";
  return "secondary";
};

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [frontendLogs, setFrontendLogs] = useState<LogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<BackendLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"frontend" | "backend">(
    "frontend",
  );

  useEffect(() => {
    const unsubscribe = subscribeLogs(setFrontendLogs);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const data = await apiClient.getBackendLogs(200);
        if (!cancelled) setBackendLogs(data.logs);
      } catch {
        if (!cancelled) {
          setBackendLogs((prev) => prev);
        }
      }
    };

    fetchLogs();
    const timer = window.setInterval(fetchLogs, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open]);

  const hasErrors = useMemo(() => {
    const frontendError = frontendLogs.some((log) => log.level === "error");
    const backendError = backendLogs.some(
      (log) => log.level.toLowerCase() === "error",
    );
    return frontendError || backendError;
  }, [frontendLogs, backendLogs]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-50">
      <Button
        variant={hasErrors ? "destructive" : "outline"}
        className="shadow-lg"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Hide Debug Logs" : "Show Debug Logs"}
      </Button>

      {open && (
        <Card className="mt-2 sm:mt-3 w-[95vw] sm:w-[420px] max-h-[50vh] sm:max-h-[420px] overflow-hidden shadow-xl border fixed bottom-12 right-2 sm:static">
          <div className="flex items-center justify-between border-b px-2 sm:px-3 py-1 sm:py-2">
            <div className="flex items-center gap-1 sm:gap-2 text-xs font-semibold flex-1 min-w-0">
              <button
                className={cn(
                  "px-2 py-1 rounded",
                  "text-xs",
                  activeTab === "frontend"
                    ? "bg-primary text-white"
                    : "bg-muted",
                )}
                onClick={() => setActiveTab("frontend")}
              >
                Frontend
              </button>
              <button
                className={cn(
                  "px-2 py-1 rounded",
                  "text-xs",
                  activeTab === "backend"
                    ? "bg-primary text-white"
                    : "bg-muted",
                )}
                onClick={() => setActiveTab("backend")}
              >
                Backend
              </button>
            </div>
          </div>

          <div className="max-h-[calc(50vh-60px)] sm:max-h-[340px] overflow-auto text-xs p-2 sm:p-3 space-y-2">
            {activeTab === "frontend" &&
              (frontendLogs.length === 0 ? (
                <div className="text-muted-foreground">
                  No frontend logs yet.
                </div>
              ) : (
                frontendLogs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <Badge variant={levelTone(log.level)} className="shrink-0">
                      {log.level}
                    </Badge>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">{log.ts}</div>
                      <div className="break-words whitespace-pre-wrap">
                        {log.message}
                      </div>
                    </div>
                  </div>
                ))
              ))}

            {activeTab === "backend" &&
              (backendLogs.length === 0 ? (
                <div className="text-muted-foreground">
                  No backend logs yet.
                </div>
              ) : (
                backendLogs.map((log, idx) => (
                  <div key={`${log.ts}-${idx}`} className="flex gap-2">
                    <Badge variant={levelTone(log.level)} className="shrink-0">
                      {log.level.toLowerCase()}
                    </Badge>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">
                        {log.ts} • {log.logger}
                      </div>
                      <div className="break-words whitespace-pre-wrap">
                        {log.message}
                      </div>
                    </div>
                  </div>
                ))
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

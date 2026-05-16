import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import apiClient, { type RBIClause, type RBIClausePayload } from "@/lib/api";
import { logError, logEvent } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OllamaStatusBar } from "@/components/OllamaWarning";

interface AnalysisEvent {
  type:
    | "queued"
    | "started"
    | "clause_progress"
    | "clause_completed"
    | "completed"
    | "error";
  clause_id?: number;
  message?: string;
  understanding?: string;
}

type AnalysisPhase = "idle" | "queued" | "running";

function normalizeLiveUnderstanding(value?: string | null): string | null {
  if (!value) return null;

  let text = value.trim();
  if (!text) return null;

  text = text
    .replace(/^```json\s*/i, "")
    .replace(/```json/gi, "")
    .replace(/^```\s*/i, "")
    .replace(/```/g, "")
    .replace(/^json\s*/i, "");

  const keyIndex = text.indexOf('"ai_understanding"');
  if (keyIndex >= 0) {
    const colonIndex = text.indexOf(":", keyIndex);
    if (colonIndex >= 0) {
      text = text.slice(colonIndex + 1).trim();
    }
  }

  if (text.startsWith("{") && text.includes('"ai_understanding"')) {
    const firstQuote = text.indexOf('"', text.indexOf(":") + 1);
    if (firstQuote >= 0) {
      text = text.slice(firstQuote + 1);
    }
  }

  text = text
    .replace(/^"/, "")
    .replace(/"\s*,\s*["'][^"']+["']\s*:[\s\S]*$/g, "")
    .replace(/"\s*}\s*$/, "")
    .replace(/"\s*,\s*$/, "")
    .replace(/}\s*$/, "")
    .replace(/^\{\s*/, "");

  text = text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  return text.trim() || null;
}

const CATEGORIES = [
  "Transparency & Disclosure",
  "Consumer Protection",
  "Grievance Redressal",
  "Data Privacy & Security",
  "Fair Practices & Recovery",
  "Key Facts Statement",
  "Foreign Exchange Compliance",
  "Other",
];

const emptyForm = (): RBIClausePayload => ({
  clause_text: "",
  predefined_meaning: "",
  category: "",
});

export default function ClausesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RBIClause | null>(null);
  const [form, setForm] = useState<RBIClausePayload>(emptyForm());
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<
    Map<number, AnalysisEvent>
  >(new Map());
  const [analysisResults, setAnalysisResults] = useState<Map<number, string>>(
    new Map(),
  );
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("idle");
  const [queuedClauseIds, setQueuedClauseIds] = useState<Set<number>>(
    new Set(),
  );

  const { data: clauses = [], isLoading } = useQuery({
    queryKey: ["clauses"],
    queryFn: apiClient.listClauses,
  });

  const createMutation = useMutation({
    mutationFn: apiClient.createClause,
    onSuccess: () => {
      logEvent("RBI clause created");
      queryClient.invalidateQueries({ queryKey: ["clauses"] });
      closeDialog();
    },
    onError: (error) => logError("Failed to create RBI clause", error),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<RBIClausePayload>;
    }) => apiClient.updateClause(id, payload),
    onSuccess: () => {
      logEvent("RBI clause updated");
      queryClient.invalidateQueries({ queryKey: ["clauses"] });
      closeDialog();
    },
    onError: (error) => logError("Failed to update RBI clause", error),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteClause,
    onSuccess: () => {
      logEvent("RBI clause deleted");
      queryClient.invalidateQueries({ queryKey: ["clauses"] });
      setPendingDeleteId(null);
    },
    onError: (error) => logError("Failed to delete RBI clause", error),
  });

  const analyzeMutation = useMutation({
    mutationFn: (force: boolean) => apiClient.analyzeClauses(force),
    onMutate: (force) => {
      const nextQueued = clauses
        .filter((clause) => force || !clause.ai_understanding)
        .map((clause) => clause.id);
      setIsAnalyzing(true);
      setAnalysisPhase("queued");
      setAnalysisProgress(new Map());
      setAnalysisResults(new Map());
      setQueuedClauseIds(new Set(nextQueued));
    },
    onError: (error) => {
      setIsAnalyzing(false);
      setAnalysisPhase("idle");
      setQueuedClauseIds(new Set());
      logError("Failed to queue RBI clause analysis", error);
    },
    onSuccess: () => {
      logEvent("RBI clause analysis queued");
    },
  });

  useEffect(() => {
    if (!isAnalyzing) return;

    const source = new EventSource("/api/clauses/progress");

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as AnalysisEvent;

        if (data.type === "queued") {
          setAnalysisPhase("queued");
          return;
        }

        if (data.type === "started") {
          setAnalysisPhase("running");
          setAnalysisProgress(new Map());
          return;
        }

        if (
          data.type === "clause_progress" ||
          data.type === "clause_completed"
        ) {
          if (typeof data.clause_id === "number") {
            setAnalysisProgress((prev) => {
              const next = new Map(prev);
              next.set(data.clause_id as number, data);
              return next;
            });
            setQueuedClauseIds((prev) => {
              const next = new Set(prev);
              next.delete(data.clause_id as number);
              return next;
            });
          }

          if (
            data.type === "clause_completed" &&
            typeof data.clause_id === "number" &&
            data.understanding
          ) {
            const understanding = normalizeLiveUnderstanding(
              data.understanding,
            );
            setAnalysisResults((prev) => {
              const next = new Map(prev);
              if (understanding) {
                next.set(data.clause_id as number, understanding);
              }
              return next;
            });
          }
          return;
        }

        if (data.type === "completed") {
          setIsAnalyzing(false);
          setAnalysisPhase("idle");
          setQueuedClauseIds(new Set());
          queryClient.invalidateQueries({ queryKey: ["clauses"] });
          source.close();
          return;
        }

        if (data.type === "error") {
          setIsAnalyzing(false);
          setAnalysisPhase("idle");
          setQueuedClauseIds(new Set());
          source.close();
        }
      } catch (error) {
        logError("Failed to parse analysis event", error);
      }
    };

    source.addEventListener("message", onMessage as EventListener);
    source.onerror = () => {
      setIsAnalyzing(false);
      setAnalysisPhase("idle");
      setQueuedClauseIds(new Set());
      source.close();
    };

    return () => {
      source.close();
    };
  }, [isAnalyzing, queryClient]);

  const isPendingSave = createMutation.isPending || updateMutation.isPending;

  const sortedClauses = useMemo(
    () => [...clauses].sort((a, b) => a.id - b.id),
    [clauses],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (clause: RBIClause) => {
    setEditing(clause);
    setForm({
      clause_text: clause.clause_text,
      predefined_meaning: clause.predefined_meaning ?? "",
      category: clause.category ?? "",
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const handleSave = () => {
    const payload: RBIClausePayload = {
      clause_text: form.clause_text.trim(),
      predefined_meaning: form.predefined_meaning?.trim() || undefined,
      category: form.category?.trim() || undefined,
    };

    if (!payload.clause_text) return;

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  Global RBI Clauses
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  Manage and analyze global clause definitions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <OllamaStatusBar />
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <h2 className="text-2xl font-bold text-gray-900">RBI Clauses</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => analyzeMutation.mutate(false)}
              disabled={analyzeMutation.isPending || isAnalyzing}
            >
              {(analyzeMutation.isPending || isAnalyzing) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {analysisPhase === "queued" ? "Queued" : "Analyze Clauses"}
            </Button>
            <Button
              variant="outline"
              onClick={() => analyzeMutation.mutate(true)}
              disabled={analyzeMutation.isPending || isAnalyzing}
            >
              {(analyzeMutation.isPending || isAnalyzing) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {analysisPhase === "queued" ? "Queued" : "Force Re-Analyze"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Clause
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedClauses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                No clauses yet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first RBI clause to begin analysis.
              </p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Clause
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedClauses.map((clause) => {
              const event = analysisProgress.get(clause.id);
              const liveUnderstanding = normalizeLiveUnderstanding(
                analysisResults.get(clause.id),
              );
              const streamingUnderstanding = normalizeLiveUnderstanding(
                event?.understanding,
              );
              const savedUnderstanding = normalizeLiveUnderstanding(
                clause.ai_understanding,
              );
              const visibleUnderstanding =
                liveUnderstanding ??
                streamingUnderstanding ??
                savedUnderstanding ??
                null;
              const isWorking = event?.type === "clause_progress";
              const isDone = event?.type === "clause_completed";
              const isQueued =
                queuedClauseIds.has(clause.id) && !isWorking && !isDone;

              return (
                <Card key={clause.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {clause.category && (
                            <Badge variant="secondary">{clause.category}</Badge>
                          )}
                          {isQueued && (
                            <Badge variant="secondary">In Queue</Badge>
                          )}
                          {isWorking && (
                            <Badge
                              variant="review"
                              className="flex items-center gap-1"
                            >
                              <Loader2 className="h-3 w-3 animate-spin" />
                              In Progress
                            </Badge>
                          )}
                          {isDone && (
                            <Badge
                              variant="success"
                              className="flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Updated
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-sm leading-relaxed">
                          {clause.clause_text}
                        </CardTitle>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(clause)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {pendingDeleteId === clause.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(clause.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDeleteId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDeleteId(clause.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {(clause.predefined_meaning || visibleUnderstanding) && (
                    <CardContent className="pt-0 space-y-2">
                      {clause.predefined_meaning && (
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          <span className="font-medium text-gray-700">
                            Meaning:{" "}
                          </span>
                          {clause.predefined_meaning}
                        </p>
                      )}
                      {visibleUnderstanding && (
                        <div className="border-t pt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">
                            AI Understanding:
                          </p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {visibleUnderstanding}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit RBI Clause" : "Add RBI Clause"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="clause_text">Clause Text</Label>
              <textarea
                id="clause_text"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Enter the full RBI clause text"
                value={form.clause_text}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, clause_text: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="predefined_meaning">Meaning</Label>
              <textarea
                id="predefined_meaning"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Optional plain-language meaning"
                value={form.predefined_meaning ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    predefined_meaning: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                list="rbi-category-options"
                value={form.category ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Choose or type category"
              />
              <datalist id="rbi-category-options">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, category: c }))
                    }
                    className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:text-primary"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.clause_text.trim() || isPendingSave}
            >
              {isPendingSave && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editing ? "Save Changes" : "Add Clause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

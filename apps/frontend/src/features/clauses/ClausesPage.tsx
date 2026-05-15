import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Pencil,
  Shield,
  ArrowLeft,
  Loader2,
  Check,
  X,
} from "lucide-react";
import apiClient, { RBIClause, RBIClausePayload } from "@/lib/api";
import { logError, logEvent } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OllamaStatusBar } from "@/components/OllamaWarning";

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

interface AnalysisEvent {
  type: string;
  clause_id?: number;
  clause_number?: number;
  total_clauses?: number;
  message?: string;
  understanding?: string;
}

export default function RBIClausesSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RBIClause | null>(null);
  const [form, setForm] = useState<RBIClausePayload>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isForceAnalyzing, setIsForceAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<
    Map<number, AnalysisEvent>
  >(new Map());
  const [analysisResults, setAnalysisResults] = useState<Map<number, string>>(
    new Map(),
  );

  const { data: clauses = [], isLoading } = useQuery({
    queryKey: ["clauses"],
    queryFn: apiClient.listClauses,
    refetchInterval: false, // Disable polling, use SSE instead
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
      setDeleteConfirm(null);
    },
    onError: (error) => logError("Failed to delete RBI clause", error),
  });

  const analyzeMutation = useMutation({
    mutationFn: (force: boolean) => apiClient.analyzeClauses(force),
    onMutate: (force) => {
      setIsAnalyzing(true);
      setIsForceAnalyzing(force);
      setAnalysisProgress(new Map());
      setAnalysisResults(new Map());
    },
    onSuccess: (data) => {
      logEvent("RBI clause analysis queued", { force: data.force });
    },
    onError: (error) => {
      setIsAnalyzing(false);
      setIsForceAnalyzing(false);
      logError("Failed to queue RBI clause analysis", error);
    },
  });

  // SSE effect to listen for analysis progress
  useEffect(() => {
    if (!isAnalyzing) return;

    const eventSource = new EventSource("/api/clauses/progress");

    const handleMessage = (event: Event) => {
      try {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data) as AnalysisEvent;

        logEvent("Analysis progress", { type: data.type });

        if (data.type === "started") {
          setAnalysisProgress(new Map());
        } else if (
          data.type === "clause_progress" ||
          data.type === "clause_completed"
        ) {
          const clauseId = data.clause_id;
          setAnalysisProgress((prev) => {
            const newMap = new Map(prev);
            if (clauseId != null) {
              newMap.set(clauseId, data);
            }
            return newMap;
          });
          if (data.type === "clause_completed" && clauseId != null) {
            setAnalysisResults((prev) => {
              const newMap = new Map(prev);
              if (data.understanding) {
                newMap.set(clauseId, data.understanding);
              }
              return newMap;
            });
          }
        } else if (data.type === "completed") {
          logEvent("RBI clause analysis completed");
          setIsAnalyzing(false);
          setIsForceAnalyzing(false);
          queryClient.invalidateQueries({ queryKey: ["clauses"] });
          eventSource.close();
        } else if (data.type === "error") {
          logError(
            "Analysis error",
            new Error(data.message || "Unknown error"),
          );
          setIsAnalyzing(false);
          setIsForceAnalyzing(false);
          eventSource.close();
        }
      } catch (error) {
        logError("Failed to parse analysis event", error);
      }
    };

    eventSource.addEventListener("message", handleMessage);
    eventSource.onerror = () => {
      logError("SSE connection error", new Error("EventSource error"));
      setIsAnalyzing(false);
      setIsForceAnalyzing(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isAnalyzing, queryClient]);

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
      logEvent("RBI clause update requested", { clauseId: editing.id });
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      logEvent("RBI clause create requested");
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <header className="bg-white border-b px-2 xs:px-4 sm:px-6 py-2 xs:py-3 sm:py-4">
                <h1 className="text-xl font-bold text-gray-900">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 xs:gap-2 px-1 xs:px-2">
                </h1>
                <p className="text-xs text-muted-foreground">
                  Global RBI Clause Settings
                </p>
              </div>
                  <h1 className="text-lg xs:text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            <div className="flex items-center gap-3">
              <OllamaStatusBar />
              <Button variant="outline" onClick={() => navigate("/")}>
                  <p className="text-xs xs:text-sm text-muted-foreground">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>
              <div className="flex-1 px-2 xs:px-4 sm:px-6 py-4 xs:py-6 space-y-6 xs:space-y-8 max-w-7xl mx-auto w-full">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">RBI Clauses</h2>
                  <CardHeader className="border-b px-3 xs:px-6 py-3 xs:py-4">
                    <CardTitle className="flex items-center gap-2 text-base xs:text-lg">
                      <Plus className="h-4 xs:h-5 w-4 xs:w-5" />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
                  <CardContent className="p-2 xs:p-6 space-y-3">
              onClick={() => analyzeMutation.mutate(false)}
              disabled={analyzeMutation.isPending || isAnalyzing}
            >
              {(analyzeMutation.isPending || isAnalyzing) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <SelectTrigger id="category" className="h-8 text-xs w-full" />
              Analyze Clauses
            </Button>
            <Button
              variant="outline"
              onClick={() => analyzeMutation.mutate(true)}
              disabled={analyzeMutation.isPending || isAnalyzing}
            >
                    <div className="space-y-1">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Force Re-Analyze
            </Button>
            <Button onClick={openCreate}>
                        className="w-full border border-input rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-20"
              Add Clause
            </Button>
          </div>
        </div>

        {isLoading ? (
                    <div className="space-y-1">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clauses.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        className="w-full border border-input rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-20"
              No RBI Clauses Defined
            </h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Add your first RBI clause to use it in compliance analysis
              sessions.
            </p>
                    <Button className="w-full gap-1 xs:gap-2 h-8 text-xs bg-primary text-white hover:bg-primary/90" onClick={addClause}>
                      <Plus className="h-3 xs:h-3.5 w-3 xs:w-3.5" />
              Add First Clause
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {clauses.map((clause) => {
              const analysisEvent = analysisProgress.get(clause.id);
                  <h2 className="text-lg xs:text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 xs:h-5 w-4 xs:w-5 text-primary" />
                liveUnderstanding ??
                (isForceAnalyzing ? null : clause.ai_understanding);
              const isCompletedBySse =
                analysisEvent?.type === "clause_completed";
                      <Card key={clause.id} className="overflow-hidden">
                        <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-2 p-2 xs:p-4">
                          <div className="space-y-1 xs:space-y-2 flex-1 min-w-0 order-1">
                            <Badge variant="outline" className="text-xs w-fit">

              return (
                            <p className="text-xs font-medium leading-snug line-clamp-2 xs:line-clamp-none">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground italic leading-snug line-clamp-2 xs:line-clamp-none">
                          {clause.category && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                          <div className="flex gap-1 shrink-0 w-full xs:w-auto order-2 xs:order-2">
                              {clause.category}
                            </Badge>
                              size="icon"
                              className="h-8 w-8 p-1 flex-1 xs:flex-none"
                            <Badge
                              variant="review"
                              className="text-xs shrink-0 flex items-center gap-1"
                            >
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Analysing
                              size="icon"
                              className="h-8 w-8 p-1 flex-1 xs:flex-none text-destructive hover:text-destructive"
                          {isDone && (
                            <Badge
                              variant="success"
                              className="text-xs shrink-0 flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Analysed
                            </Badge>
                          )}
                          {isQueued && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0 flex items-center gap-1"
                            >
                              <Loader2 className="h-3 w-3 animate-spin" />
                              In Queue
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-sm font-medium leading-snug text-gray-900">
                          {clause.clause_text}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(clause)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirm === clause.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(clause.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteConfirm(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(clause.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {(clause.predefined_meaning || visibleUnderstanding) && (
                    <CardContent className="pt-0 pb-3 space-y-2">
                      {clause.predefined_meaning && (
                        <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 pb-2">
                          <span className="font-medium text-gray-600">
                            Meaning:{" "}
                          </span>
                          {clause.predefined_meaning}
                        </p>
                      )}
                      {visibleUnderstanding && (
                        <div className="border-t pt-2">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            AI Understanding:
                          </p>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
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
              <Label htmlFor="clause_text">
                Clause Text <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="clause_text"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Enter the full RBI clause text..."
                value={form.clause_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clause_text: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="predefined_meaning">Meaning</Label>
              <textarea
                id="predefined_meaning"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Plain-language explanation of what this clause means..."
                value={form.predefined_meaning ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, predefined_meaning: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <div className="flex gap-2">
                <Input
                  id="category"
                  list="category-options"
                  placeholder="e.g. Consumer Protection"
                  value={form.category ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
                <datalist id="category-options">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.category === c
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                    }`}
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
              disabled={!form.clause_text.trim() || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Add Clause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

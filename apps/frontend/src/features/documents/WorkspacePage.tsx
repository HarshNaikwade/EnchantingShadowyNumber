import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Calendar,
  Shield,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import apiClient, { type Document, type DocumentProgress } from "@/lib/api";
import { logError, logEvent } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ComplianceTables } from "@/features/compliance/ComplianceTables";
import { OllamaStatusBar } from "@/components/OllamaWarning";

const DOC_TYPES = ["Agreement", "Amendment", "Addendum", "MOU"];

const DONE_STATUSES = new Set(["completed", "failed", "completed_no_ai"]);

const statusBadge: Record<string, string> = {
  completed: "success",
  processing: "warning",
  queued: "secondary",
  pending: "secondary",
  failed: "danger",
  completed_no_ai: "review",
};

function DocumentCard({
  doc,
  sessionId,
  rbiClauses,
  index,
}: {
  doc: Document;
  sessionId: number;
  rbiClauses: any[];
  index: number;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editEffective, setEditEffective] = useState(doc.effective_date);
  const [editCreation, setEditCreation] = useState(doc.creation_date);
  const [editingDates, setEditingDates] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["docStatus", doc.id],
    queryFn: () => apiClient.getDocumentStatus(doc.id),
    refetchInterval: (query) => {
      const s = (query.state.data as { status: string } | undefined)?.status ?? doc.processing_status;
      return DONE_STATUSES.has(s) ? false : 3000;
    },
  });

  const currentStatus = status?.status ?? doc.processing_status;
  const isDone = DONE_STATUSES.has(currentStatus);

  const { data: progress } = useQuery<DocumentProgress>({
    queryKey: ["docProgress", doc.id],
    queryFn: () => apiClient.getDocumentProgress(doc.id),
    refetchInterval: !isDone && (currentStatus === "processing" || currentStatus === "queued") ? 3000 : false,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteDocument(doc.id),
    onSuccess: () => {
      logEvent("Document deleted", { documentId: doc.id });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error) => logError("Failed to delete document", error),
  });

  const rerunMutation = useMutation({
    mutationFn: () => apiClient.rerunDocument(doc.id),
    onSuccess: () => {
      logEvent("AI analysis re-queued", { documentId: doc.id });
      queryClient.invalidateQueries({ queryKey: ["docStatus", doc.id] });
      queryClient.invalidateQueries({ queryKey: ["docProgress", doc.id] });
      queryClient.invalidateQueries({ queryKey: ["results", sessionId, doc.id] });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error) => logError("Failed to re-run analysis", error),
  });

  const updateDatesMutation = useMutation({
    mutationFn: () =>
      apiClient.updateDocumentDates(doc.id, editEffective, editCreation),
    onSuccess: () => {
      logEvent("Document dates updated", { documentId: doc.id });
      setEditingDates(false);
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error) => logError("Failed to update document dates", error),
  });

  const reportUrl = apiClient.getDocumentReportUrl(sessionId, doc.id);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 flex-1 min-w-0">
          <span className="text-muted-foreground w-6 shrink-0">{index}.</span>
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold">{doc.file_type}</span>
            <span className="text-muted-foreground"> — </span>
            <span className="text-gray-600 truncate">
              {doc.original_filename}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Calendar className="h-3 w-3" />
          <span>Effective: {doc.effective_date}</span>
        </div>

        <Badge variant={statusBadge[currentStatus] as any} className="shrink-0">
          {currentStatus === "processing" || currentStatus === "queued" ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {currentStatus}
            </span>
          ) : (
            currentStatus
          )}
        </Badge>

        <div className="flex items-center gap-1 shrink-0">
          <a href={reportUrl} download target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Download className="h-3.5 w-3.5" />
              Report
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this document?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          <div className="p-4 bg-slate-50 flex flex-wrap items-end gap-4 border-b">
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Effective Date</Label>
                <Input
                  className="h-8 text-xs w-36"
                  value={editEffective}
                  onChange={(e) => {
                    setEditEffective(e.target.value);
                    setEditingDates(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Creation Date</Label>
                <Input
                  className="h-8 text-xs w-36"
                  value={editCreation}
                  onChange={(e) => {
                    setEditCreation(e.target.value);
                    setEditingDates(true);
                  }}
                />
              </div>
              {editingDates && (
                <Button
                  size="sm"
                  className="h-8 text-xs mt-4"
                  onClick={() => updateDatesMutation.mutate()}
                  disabled={updateDatesMutation.isPending}
                >
                  Save Dates
                </Button>
              )}
            </div>

            {(currentStatus === "processing" || currentStatus === "queued") && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 ml-auto">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI analysis in progress... This may take a few minutes.
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 p-1"
                  onClick={() => {
                    logEvent("Status refresh requested", {
                      documentId: doc.id,
                    });
                    refetchStatus();
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}

            {progress &&
              (currentStatus === "processing" ||
                currentStatus === "queued") && (
                <div className="ml-auto text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">AI step:</span>
                    <span className="capitalize">
                      {progress.step.replace(/_/g, " ")}
                    </span>
                    {progress.stalled && (
                      <span className="text-amber-700">
                        No response received for{" "}
                        {progress.last_chunk_age ?? "?"}s
                      </span>
                    )}
                  </div>
                  {progress.message && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {progress.message}
                    </div>
                  )}
                  {progress.response_preview && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] bg-white border border-slate-200 rounded p-2">
                      {progress.response_preview}
                    </pre>
                  )}
                  {progress.error && (
                    <div className="mt-2 text-xs text-destructive">
                      {progress.error}
                    </div>
                  )}
                </div>
              )}

            {currentStatus === "completed_no_ai" && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 ml-auto">
                <AlertCircle className="h-3.5 w-3.5" />
                AI provider was not reachable during analysis.
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs ml-1"
                  disabled={rerunMutation.isPending}
                  onClick={() => rerunMutation.mutate()}
                >
                  {rerunMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Re-run Analysis
                    </>
                  )}
                </Button>
              </div>
            )}

            {currentStatus === "failed" && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-1.5 ml-auto">
                <AlertCircle className="h-3.5 w-3.5" />
                Analysis failed.
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs ml-1"
                  disabled={rerunMutation.isPending}
                  onClick={() => rerunMutation.mutate()}
                >
                  {rerunMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Re-run Analysis
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="p-4">
            <ComplianceTables
              sessionId={sessionId}
              documentId={doc.id}
              rbiClauses={rbiClauses}
              isComplete={isDone}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionId = Number(id);

  const [docType, setDocType] = useState("Agreement");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => apiClient.getSession(sessionId),
    refetchInterval: (query) => {
      const data = query.state.data as typeof session | undefined;
      if (!data) return 5000;
      const sessionDone = DONE_STATUSES.has(data.status);
      const allDocsDone = data.documents.every((d) =>
        DONE_STATUSES.has(d.processing_status)
      );
      return sessionDone && allDocsDone ? false : 5000;
    },
  });

  const { data: rbiClauses = [] } = useQuery({
    queryKey: ["rbiClauses", sessionId],
    queryFn: () => apiClient.getRBIClauses(sessionId),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadError(null);
      logEvent("File selected", { name: acceptedFiles[0].name });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      logEvent("Upload started", { sessionId, fileName: selectedFile.name });
      await apiClient.uploadDocument(sessionId, selectedFile, docType);
      setSelectedFile(null);
      logEvent("Upload completed", { sessionId, fileType: docType });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    } catch (err: any) {
      setUploadError(
        err.response?.data?.detail || "Upload failed. Please try again.",
      );
      logError("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const reportUrl = apiClient.getReportUrl(sessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Session not found</p>
        <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-none">
                  {session.title}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {format(new Date(session.created_at), "dd MMM yyyy")}{" "}
                  • {session.documents.length} document
                  {session.documents.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <OllamaStatusBar />
              <a href={reportUrl} download target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Full Report PDF
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 w-44">
                <Label className="text-xs">Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-64">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-gray-800">
                        {selectedFile.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground/60" />
                      {isDragActive
                        ? "Drop file here..."
                        : "Drag & drop or click to select PDF/DOCX"}
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="h-9 shrink-0"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {uploadError}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Document History
            </h2>
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {session.documents.length} document
              {session.documents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {session.documents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No documents uploaded yet. Upload your first agreement above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {session.documents.map((doc, i) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  sessionId={sessionId}
                  rbiClauses={rbiClauses}
                  index={i + 1}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import apiClient, { type Document, type RBIClause } from "@/lib/api";
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
import { cn } from "@/lib/utils";

const DOC_TYPES = ["Agreement", "Amendment", "Addendum", "MOU"];
const DONE_STATUSES = new Set(["completed", "failed", "completed_no_ai"]);

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "review";

const statusBadge: Record<string, BadgeVariant> = {
  completed: "success",
  processing: "warning",
  queued: "secondary",
  pending: "secondary",
  failed: "danger",
  completed_no_ai: "review",
};

const statusLabel: Record<string, string> = {
  completed: "Completed",
  processing: "Processing",
  queued: "In Queue",
  pending: "Pending",
  failed: "Failed",
  completed_no_ai: "Completed - No AI",
};

function safeFormatDate(dateInput: string): string {
  try {
    return format(new Date(dateInput), "PPp");
  } catch {
    return dateInput;
  }
}

function formatLiveAiPreview(preview: string): string {
  let text = preview
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .trim();

  const keyMatch = text.match(
    /["'](?:ai_understanding|ai_understanding_agreement|notes|simplified_meaning)["']\s*:\s*/i,
  );
  if (keyMatch?.index !== undefined) {
    text = text.slice(keyMatch.index + keyMatch[0].length).trimStart();
  }

  text = text
    .replace(/^["']/, "")
    .replace(/"\s*,\s*["'][^"']+["']\s*:[\s\S]*$/g, "")
    .replace(/"\s*[,}]\s*$/g, "")
    .replace(/\s*}\s*$/g, "")
    .replace(/\s*,\s*$/g, "")
    .trim();

  return text;
}

function DocumentCard({
  doc,
  index,
  sessionId,
  rbiClauses,
}: {
  doc: Document;
  index: number;
  sessionId: number;
  rbiClauses: RBIClause[];
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(doc.effective_date);
  const [creationDate, setCreationDate] = useState(doc.creation_date);
  const [datesDirty, setDatesDirty] = useState(false);

  const isDone = DONE_STATUSES.has(doc.processing_status);

  const { data: progress } = useQuery({
    queryKey: ["documentProgress", doc.id],
    queryFn: () => apiClient.getDocumentProgress(doc.id),
    enabled: !isDone,
    refetchInterval: 2000,
  });

  const liveStatus = progress?.status ?? doc.processing_status;
  const liveAiPreview = formatLiveAiPreview(progress?.response_preview ?? "");

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteDocument(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({
        queryKey: ["results", sessionId, doc.id],
      });
    },
    onError: (error) => logError("Delete document failed", error),
  });

  const rerunMutation = useMutation({
    mutationFn: () => apiClient.rerunDocument(doc.id),
    onSuccess: () => {
      logEvent("Document rerun queued", { documentId: doc.id });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({
        queryKey: ["results", sessionId, doc.id],
      });
      queryClient.invalidateQueries({ queryKey: ["documentProgress", doc.id] });
    },
    onError: (error) => logError("Rerun failed", error),
  });

  const updateDatesMutation = useMutation({
    mutationFn: () =>
      apiClient.updateDocumentDates(doc.id, effectiveDate, creationDate),
    onSuccess: () => {
      setDatesDirty(false);
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error) => logError("Date update failed", error),
  });

  const reportUrl = apiClient.getDocumentReportUrl(sessionId, doc.id);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xs text-muted-foreground w-6 shrink-0">
            {index}.
          </span>
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {doc.file_type} - {doc.original_filename}
            </p>
            <p className="text-xs text-muted-foreground">
              Uploaded {safeFormatDate(doc.upload_date)}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Effective: {doc.effective_date || "NA"}
        </div>

        <Badge
          variant={statusBadge[liveStatus] ?? "secondary"}
          className="whitespace-nowrap"
        >
          {liveStatus === "processing" || liveStatus === "queued" ? (
            <span className="flex items-center gap-1">
              {liveStatus === "processing" && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {statusLabel[liveStatus] ?? liveStatus}
            </span>
          ) : (
            statusLabel[liveStatus] ?? liveStatus
          )}
        </Badge>

        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
          <a href={reportUrl} download target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-8">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this document?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setExpanded((v) => !v)}
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
        <div className="bg-slate-50">
          <div className="p-4 border-b space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Effective Date</Label>
                <Input
                  value={effectiveDate}
                  onChange={(e) => {
                    setEffectiveDate(e.target.value);
                    setDatesDirty(true);
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Creation Date</Label>
                <Input
                  value={creationDate}
                  onChange={(e) => {
                    setCreationDate(e.target.value);
                    setDatesDirty(true);
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!datesDirty || updateDatesMutation.isPending}
                  onClick={() => updateDatesMutation.mutate()}
                >
                  {updateDatesMutation.isPending && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  Save Dates
                </Button>
              </div>
              <div className="flex gap-2 justify-start lg:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={rerunMutation.isPending}
                  onClick={() => rerunMutation.mutate()}
                >
                  {rerunMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Re-run Analysis
                </Button>
              </div>
            </div>

            {progress && !progress.done && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <p className="font-medium capitalize">
                  {progress.step.replace(/_/g, " ")}
                </p>
                {progress.message && (
                  <p className="mt-0.5">{progress.message}</p>
                )}
                {liveAiPreview && (
                  <div className="mt-2 max-h-36 overflow-auto rounded border border-blue-200 bg-white/80 px-3 py-2 text-gray-700">
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {liveAiPreview}
                    </p>
                  </div>
                )}
              </div>
            )}

            {progress?.error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5" />
                {progress.error}
              </div>
            )}
          </div>

          <div className="p-4 bg-white">
            <ComplianceTables
              sessionId={sessionId}
              documentId={doc.id}
              rbiClauses={rbiClauses}
              isComplete={DONE_STATUSES.has(liveStatus)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessionId = Number(id);

  const [docType, setDocType] = useState("Agreement");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => apiClient.getSession(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const { data: rbiClauses = [] } = useQuery({
    queryKey: ["rbiClauses", sessionId],
    queryFn: () => apiClient.getRBIClauses(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      apiClient.uploadDocument(sessionId, file, docType),
    onSuccess: () => {
      setSelectedFile(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error: unknown) => {
      logError("Upload failed", error);
      setUploadError("Upload failed. Please try again.");
    },
  });

  const onDrop = (files: File[]) => {
    if (!files.length) return;
    setSelectedFile(files[0]);
    setUploadError(null);
    logEvent("File selected", { fileName: files[0].name });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Session not found.</p>
        <Button onClick={() => navigate("/")}>Back to Sessions</Button>
      </div>
    );
  }

  const reportUrl = apiClient.getReportUrl(sessionId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-900">
                  Session - {session.title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Created {safeFormatDate(session.created_at)}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
              <OllamaStatusBar />
              <a href={reportUrl} download target="_blank" rel="noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 whitespace-nowrap"
                >
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
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5 w-48">
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

              <div className="flex-1 min-w-[240px]">
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-gray-800 truncate max-w-[70%]">
                        {selectedFile.name}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground/60" />
                      {isDragActive
                        ? "Drop file here"
                        : "Drag/drop or click to choose PDF or DOCX"}
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="h-9"
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
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
            <Card>
              <CardContent className="py-10 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet. Upload your first file above.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {session.documents.map((doc, idx) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  index={idx + 1}
                  sessionId={sessionId}
                  rbiClauses={rbiClauses}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

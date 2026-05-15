import { useState, useCallback, useEffect } from "react";
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
  const [liveStatus, setLiveStatus] = useState(doc.processing_status);
  const [liveProgress, setLiveProgress] = useState<DocumentProgress | null>(
    null,
  );

  const formatProgressStep = (step: string) => {
    if (step === "thinking") return "Thinking";
    if (step === "generating_response") return "Generating response";
    return step.replace(/_/g, " ");
  };

  const currentStatus = liveStatus;
  const isDone = DONE_STATUSES.has(currentStatus);

  useEffect(() => {
    if (DONE_STATUSES.has(currentStatus)) {
      return;
    }

    const eventSource = new EventSource(
      `/api/document/${doc.id}/progress/stream`,
    );

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as DocumentProgress & {
          status?: string;
        };

        setLiveProgress(data);
        if (data.status) {
          setLiveStatus(data.status);
        }

        if (data.done) {
          const finalStatus = data.status || doc.processing_status;
          setLiveStatus(finalStatus);
          setLiveProgress(data);
          queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
          queryClient.invalidateQueries({
            queryKey: ["results", sessionId, doc.id],
          });
          eventSource.close();
        }
      } catch (error) {
        logError("Failed to parse document progress event", error);
      }
    };

    eventSource.addEventListener("message", handleMessage);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [currentStatus, doc.id, doc.processing_status, queryClient, sessionId]);

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
      setLiveStatus("queued");
      setLiveProgress(null);
      queryClient.removeQueries({ queryKey: ["results", sessionId, doc.id] });
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
           <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 p-2 xs:p-4">
             <div className="flex items-center gap-1 xs:gap-2 text-xs xs:text-sm font-medium text-gray-700 flex-1 min-w-0 order-2 xs:order-1">
               <span className="text-muted-foreground text-xs xs:w-6 shrink-0">{index}.</span>
               <FileText className="h-3 xs:h-4 w-3 xs:w-4 text-primary shrink-0" />
               <div className="min-w-0 flex-1">
                 <span className="font-semibold text-xs xs:text-sm">{doc.file_type}</span>
                 <span className="text-muted-foreground text-xs"> — </span>
                 <span className="text-gray-600 truncate text-xs xs:text-sm">
                </Button>
              )}
            </div>

            {(currentStatus === "processing" || currentStatus === "queued") && (
           <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2 xs:gap-3 text-xs">
               <Calendar className="h-3 w-3 hidden xs:inline" />
               <span className="text-muted-foreground font-medium text-xs">Type</span>
                <Button
                  variant="ghost"
                  size="sm"
               <span className="text-muted-foreground font-medium text-xs">
                  onClick={() => {
                   <Loader2 className="h-2 xs:h-3 w-2 xs:w-3 animate-spin" />
                      documentId: doc.id,
                    });
                    queryClient.invalidateQueries({
               <span className="text-muted-foreground font-medium text-xs">
                    });
                  }}
                >
             <div className="flex gap-1 shrink-0 w-full xs:w-auto order-4 xs:order-4">
                </Button>
                   <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1 xs:flex-none px-2">
                     <Download className="h-3 xs:h-3.5 w-3 xs:w-3.5" />
                     <span className="hidden xs:inline">Report</span>
            {liveProgress &&
               className="text-xs h-7 px-2 w-full xs:w-auto"
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-8 w-8 p-1"
                    <span className="capitalize">
                      {formatProgressStep(liveProgress.step)}
             <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                   <ChevronUp className="h-3 xs:h-4 w-3 xs:w-4" />
                 ) : (
                 <Input
                   type="date"
                   value={editEffective}
                   onChange={(e) => setEditEffective(e.target.value)}
                   className="h-7 text-xs w-full"
                 size="icon"
                 className="h-8 w-8 p-1 text-destructive hover:text-destructive"
                      {liveProgress.message}
                    </div>
                 <Input
                   type="date"
                   value={editCreation}
                   onChange={(e) => setEditCreation(e.target.value)}
                   className="h-7 text-xs w-full"
                  )}
                  {liveProgress.error && (
                    <div className="mt-2 text-xs text-destructive">
                      {liveProgress.error}
                    </div>
                  )}
                </div>
               size="sm"
               className="text-xs h-7 px-2 xs:px-3"
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
                   <Loader2 className="h-2 xs:h-3 w-2 xs:w-3 mr-1 animate-spin" />
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Re-run Analysis
                    </>
               <div className="p-2 xs:p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2">
                 <AlertCircle className="h-3 xs:h-4 w-3 xs:w-4 shrink-0" />
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
                 size="sm"
                 className="text-xs h-7 gap-1 px-2 w-full"
                >
                  {rerunMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                   <Loader2 className="h-2 xs:h-3 w-2 xs:w-3 animate-spin" />
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
     <header className="bg-white border-b px-2 xs:px-4 sm:px-6 py-2 xs:py-3 sm:py-4">
      logEvent("Upload completed", { sessionId, fileType: docType });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    } catch (err: any) {
      setUploadError(
        err.response?.data?.detail || "Upload failed. Please try again.",
      );
      logError("Upload failed", err);
         <h1 className="text-lg xs:text-2xl sm:text-3xl font-bold text-gray-900 truncate">Session — {session.name}</h1>
      setUploading(false);
            Created on {format(new Date(session.created_at), "PPp")}
  };

  const reportUrl = apiClient.getReportUrl(sessionId);

     <div className="flex-1 px-2 xs:px-4 sm:px-6 py-4 xs:py-6 space-y-6 xs:space-y-8 max-w-7xl mx-auto w-full">
    return (
      <div className="flex items-center justify-center min-h-screen">
       <div {...getRootProps()} className={cn(
         "border-2 border-dashed rounded-lg p-4 xs:p-6 sm:p-8 text-center cursor-pointer transition-all",
    );
  }

  if (!session) {
    return (
             <Loader2 className="h-6 xs:h-8 w-6 xs:w-8 mx-auto mb-2 xs:mb-3 animate-spin text-primary" />
             <p className="text-xs xs:text-sm font-medium">Uploading {uploadMutation.variables?.files.length} file(s)...</p>
        <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
      </div>
    );
             <Upload className="h-6 xs:h-8 w-6 xs:w-8 mx-auto mb-2 xs:mb-3 text-primary" />
             <p className="text-xs xs:text-sm font-medium">Drop files here...</p>
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
             <Upload className="h-6 xs:h-8 w-6 xs:w-8 mx-auto mb-2 xs:mb-3 text-gray-400" />
             <p className="text-xs xs:text-sm font-medium">Drag & drop documents here, or click to select</p>
             <p className="text-xs text-muted-foreground mt-0.5 xs:mt-1">Supported: PDF, TXT, DOCX</p>
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
           <h2 className="text-lg xs:text-xl font-semibold text-gray-800 flex items-center gap-2">
             <FileText className="h-4 xs:h-5 w-4 xs:w-5" />
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

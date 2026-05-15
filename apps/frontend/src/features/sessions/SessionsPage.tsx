import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Calendar,
  Trash2,
  ChevronRight,
  Shield,
  Loader2,
  Settings2,
} from "lucide-react";
import { format } from "date-fns";
import apiClient from "@/lib/api";
import { logError, logEvent } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OllamaStatusBar } from "@/components/OllamaWarning";
import DevToolsPanel from "@/components/DevToolsPanel";

const statusVariant: Record<
  string,
  "default" | "success" | "warning" | "danger" | "review" | "secondary"
> = {
  completed: "success",
  processing: "warning",
  pending: "secondary",
  failed: "danger",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: apiClient.listSessions,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => apiClient.createSession(title),
    onSuccess: (session) => {
      logEvent("Session created", { sessionId: session.id });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setShowCreate(false);
      setNewTitle("");
      navigate(`/analysis/${session.id}`);
    },
    onError: (error) => logError("Failed to create session", error),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteSession,
    onSuccess: () => {
      logEvent("Session deleted");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => logError("Failed to delete session", error),
  });

  const handleCreate = () => {
    if (newTitle.trim()) {
      logEvent("Create session requested", { title: newTitle.trim() });
      createMutation.mutate(newTitle.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1">
               <div className="flex items-center gap-2 sm:gap-3">
                 <div className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                   <Shield className="h-4 sm:h-5 w-4 sm:h-5 text-white" />
                 </div>
                 <div className="min-w-0">
                   <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                     RBI Compliance Checker
                   </h1>
                   <p className="text-xs text-muted-foreground hidden sm:block">
                     Local Agreement Analysis System
                   </p>
                 </div>
               </div>
               <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-3 w-full sm:w-auto">
                 <div className="flex-1 xs:flex-none">
                   <OllamaStatusBar />
                 </div>
                 <div className="flex gap-2 xs:gap-3">
                   <Button
                     variant="outline"
                     onClick={() => navigate("/settings/clauses")}
                     className="flex-1 xs:flex-none text-xs sm:text-sm"
                     size="sm"
                   >
                     <Settings2 className="h-3 sm:h-4 w-3 sm:w-4" />
                     <span className="hidden sm:inline ml-2">Manage Clauses</span>
                   </Button>
                   <Button
                     onClick={() => setShowCreate(true)}
                     className="flex-1 xs:flex-none text-xs sm:text-sm"
                     size="sm"
                   >
                     <Plus className="h-3 sm:h-4 w-3 sm:w-4" />
                     <span className="hidden xs:inline ml-2">New</span>
                     <span className="xs:hidden">+</span>
                   </Button>
                 </div>
               </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="mb-4 sm:mb-6">
           <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Analysis Sessions
          </h2>
           <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Upload legal agreements and analyze them against RBI compliance
            standards.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Analysis Sessions Yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Create your first analysis session to start checking agreements
              against RBI compliance standards.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Analysis
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(`/analysis/${session.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                      {session.title}
                    </CardTitle>
                    <Badge
                      variant={statusVariant[session.status] || "secondary"}
                      className="ml-2 shrink-0 capitalize"
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(session.created_at), "dd MMM yyyy, HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>
                        {session.document_count} document
                        {session.document_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this analysis session?")) {
                            deleteMutation.mutate(session.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Analysis Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                placeholder="e.g. HDFC Bank Loan Agreement - Q4 2024"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DevToolsPanel />
    </div>
  );
}

// DEV ONLY — This component is rendered only when import.meta.env.DEV is true.
import { useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bug, X, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api";

type Tab = "summary" | "raw" | "cleaned" | "pages" | "clauses" | "diff";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary",  label: "Summary"      },
  { id: "raw",      label: "Raw Text"     },
  { id: "cleaned",  label: "Cleaned Text" },
  { id: "pages",    label: "Pages"        },
  { id: "clauses",  label: "Clauses"      },
  { id: "diff",     label: "Diff"         },
];

interface DevSection {
  type: string;
  heading: string;
}

interface DevPage {
  page_number: number;
  text: string;
  char_count: number;
}

interface DevMetadata {
  dates: string[];
  parties: string[];
  headings: string[];
}

interface DevValidation {
  missing_ratio: number;
  raw_text_hash: string;
  cleaned_text_hash: string;
  raw_vs_cleaned_diff: string;
}

interface DevParsedResponse {
  document_id: number;
  file_name: string;
  file_type: string;
  processing_status: string;
  raw_text_length: number;
  cleaned_text_length: number;
  raw_text_full: string;
  cleaned_text_full: string;
  validation: DevValidation;
  metadata: DevMetadata;
  detected_sections: DevSection[];
  pages: DevPage[];
  extracted_clauses: unknown[];
}

function ScrollBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-auto rounded border border-border bg-gray-50 p-3 text-xs font-mono whitespace-pre-wrap break-words ${className}`}
      style={{ maxHeight: "52vh" }}
    >
      {children}
    </div>
  );
}

function PageItem({ page }: { page: { page_number: number; text: string; char_count: number } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded mb-2">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Page {page.page_number} — {page.char_count.toLocaleString()} chars</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <ScrollBox className="max-h-60">{page.text || "(empty)"}</ScrollBox>
        </div>
      )}
    </div>
  );
}

export default function DevToolsPanel() {
  if (!import.meta.env.DEV) return null;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [docIdInput, setDocIdInput] = useState("");
  const [docId, setDocId] = useState<number | null>(null);

  const parsedQuery = useQuery<DevParsedResponse>({
    queryKey: ["dev-parsed", docId],
    queryFn: () => apiClient.getDevParsed(docId!),
    enabled: docId !== null,
    retry: false,
  });

  const rbiMutation = useMutation<unknown[], Error>({
    mutationFn: (): Promise<unknown[]> => apiClient.testRbiAi(),
  });

  const d = parsedQuery.data;

  const fetch = () => {
    const n = parseInt(docIdInput, 10);
    if (!isNaN(n) && n > 0) {
      setDocId(n);
      setTab("summary");
    }
  };

  return (
    <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 z-50">
      <Button
        variant="outline"
        size="sm"
        className="shadow-lg gap-1.5 bg-white text-xs sm:text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Bug className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
        Dev Tools
      </Button>

      {open && (
        <div
          className="fixed inset-2 sm:inset-4 bg-white border border-border rounded-lg sm:rounded-xl shadow-2xl z-50 flex flex-col"
          style={{ top: "3rem", bottom: "3rem" }}
        >
          <div className="flex items-center justify-between border-b px-2 sm:px-4 py-2 sm:py-3 shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <Bug className="h-3 sm:h-4 w-3 sm:w-4 text-primary shrink-0" />
              <span className="font-semibold text-xs sm:text-sm truncate">Dev Tools</span>
              <Badge variant="secondary" className="text-xs">DEV ONLY</Badge>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="h-3 sm:h-4 w-3 sm:w-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-b px-2 sm:px-4 py-2 sm:py-2.5 shrink-0 bg-gray-50 overflow-x-auto">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Document ID:</span>
            <Input
              className="h-7 w-full sm:w-28 text-xs font-mono"
              placeholder="e.g. 1"
              value={docIdInput}
              onChange={(e) => setDocIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetch()}
            />
            <Button
              size="sm"
              className="h-7 text-xs px-2 sm:px-3 whitespace-nowrap"
              onClick={fetch}
              disabled={parsedQuery.isFetching}
            >
              {parsedQuery.isFetching
                ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span className="hidden sm:inline">Loading…</span>
                  </>
                )
                : <span className="hidden sm:inline">Debug Full Parsed Document</span>}
            </Button>

            <div className="h-4 w-px bg-border mx-1" />

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 sm:px-3 whitespace-nowrap"
              onClick={() => {
                console.log("[DevTools] Triggering RBI AI analysis test…");
                rbiMutation.mutate();
              }}
              disabled={rbiMutation.isPending}
            >
              {rbiMutation.isPending
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /><span className="hidden sm:inline">Running…</span></>
                : <span className="hidden sm:inline">Test RBI AI Analysis</span>}
            </Button>

            {rbiMutation.isSuccess && (
              <Badge variant="success" className="text-xs">
                {rbiMutation.data.length} clauses processed
              </Badge>
            )}
            {rbiMutation.isError && (
              <Badge variant="danger" className="text-xs">AI Error</Badge>
            )}
          </div>

          {/* RBI AI results (shown inline if present) */}
          {rbiMutation.isSuccess && (
            <div className="border-b px-4 py-2 shrink-0 bg-amber-50">
              <p className="text-xs font-semibold mb-1 text-amber-800">RBI AI Analysis Results (also logged to console):</p>
              <ScrollBox className="max-h-32">
                {JSON.stringify(rbiMutation.data, null, 2)}
              </ScrollBox>
            </div>
          )}

          {/* Error state */}
          {parsedQuery.isError && (
            <div className="px-4 py-3 text-xs text-red-600 bg-red-50 border-b shrink-0">
              Error: {(parsedQuery.error as Error)?.message ?? "Failed to load parsed data"}
            </div>
          )}

          {d && (
            <>
              <div className="flex gap-1 border-b px-4 pt-2 shrink-0 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`text-xs px-3 py-1.5 rounded-t border-b-2 transition-colors whitespace-nowrap ${
                      tab === t.id
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto px-4 py-3">

                {tab === "summary" && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Document ID", value: d.document_id },
                        { label: "File", value: d.file_name },
                        { label: "Type", value: d.file_type },
                        { label: "Status", value: d.processing_status },
                        { label: "Raw Length", value: `${d.raw_text_length.toLocaleString()} chars` },
                        { label: "Cleaned Length", value: `${d.cleaned_text_length.toLocaleString()} chars` },
                        { label: "Missing Ratio", value: `${(d.validation.missing_ratio * 100).toFixed(2)}%` },
                        { label: "Pages", value: d.pages.length },
                      ].map((item) => (
                        <div key={item.label} className="border border-border rounded p-2.5 bg-gray-50">
                          <div className="text-muted-foreground mb-0.5">{item.label}</div>
                          <div className="font-semibold font-mono truncate">{String(item.value)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-semibold">SHA-256 Hashes</p>
                      <div className="border border-border rounded p-2 bg-gray-50 font-mono break-all">
                        <span className="text-muted-foreground">raw:     </span>{d.validation.raw_text_hash}<br />
                        <span className="text-muted-foreground">cleaned: </span>{d.validation.cleaned_text_hash}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-semibold">Metadata</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="border border-border rounded p-2 bg-gray-50">
                          <p className="text-muted-foreground mb-1">Dates</p>
                          {d.metadata.dates.map((dt: string, i: number) => <div key={i}>{dt}</div>)}
                        </div>
                        <div className="border border-border rounded p-2 bg-gray-50">
                          <p className="text-muted-foreground mb-1">Parties ({d.metadata.parties.length})</p>
                          {d.metadata.parties.map((p: string, i: number) => <div key={i} className="truncate">{p}</div>)}
                        </div>
                        <div className="border border-border rounded p-2 bg-gray-50">
                          <p className="text-muted-foreground mb-1">Headings ({d.metadata.headings.length})</p>
                          <div className="overflow-auto max-h-28">
                            {d.metadata.headings.map((h: string, i: number) => <div key={i} className="truncate">{h}</div>)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-semibold">Detected Sections ({d.detected_sections.length})</p>
                      <ScrollBox className="max-h-40">
                        {d.detected_sections.map((s: DevSection, i: number) => (
                          <div key={i}><span className="text-muted-foreground">[{s.type}]</span> {s.heading}</div>
                        ))}
                      </ScrollBox>
                    </div>
                  </div>
                )}

                {tab === "raw" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Full raw extracted text — {d.raw_text_length.toLocaleString()} chars — no truncation.
                    </p>
                    <ScrollBox>{d.raw_text_full || "(empty)"}</ScrollBox>
                  </div>
                )}

                {tab === "cleaned" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Cleaned text (whitespace normalised) — {d.cleaned_text_length.toLocaleString()} chars.
                    </p>
                    <ScrollBox>{d.cleaned_text_full || "(empty)"}</ScrollBox>
                  </div>
                )}

                {tab === "pages" && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground mb-2">
                      {d.pages.length} page{d.pages.length !== 1 ? "s" : ""} — click to expand.
                    </p>
                    {d.pages.map((pg: DevPage) => <PageItem key={pg.page_number} page={pg} />)}
                  </div>
                )}

                {tab === "clauses" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {d.extracted_clauses.length} clause result{d.extracted_clauses.length !== 1 ? "s" : ""} stored for this document.
                    </p>
                    <ScrollBox>{JSON.stringify(d.extracted_clauses, null, 2)}</ScrollBox>
                  </div>
                )}

                {tab === "diff" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Unified diff — raw vs cleaned. Missing ratio: {(d.validation.missing_ratio * 100).toFixed(2)}%.
                    </p>
                    <ScrollBox>
                      {d.validation.raw_vs_cleaned_diff
                        ? d.validation.raw_vs_cleaned_diff
                        : "(no differences — raw and cleaned are identical)"}
                    </ScrollBox>
                  </div>
                )}

              </div>
            </>
          )}

          {!d && !parsedQuery.isFetching && !parsedQuery.isError && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Enter a document ID above and click "Debug Full Parsed Document" to inspect parsing data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

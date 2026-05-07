export type ComplianceStatus = "Compliant" | "Non-Compliant" | "Review";

export type DocumentType = "Agreement" | "Amendment" | "Addendum" | "MOU";

export type AIProvider = "ollama" | "groq";

export type ProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "completed_no_ai"
  | "failed";

export type SessionStatus = "pending" | "processing" | "completed" | "failed";

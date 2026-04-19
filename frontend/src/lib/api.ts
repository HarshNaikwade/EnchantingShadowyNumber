import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export interface AnalysisSession {
  id: number
  title: string
  created_at: string
  status: string
  document_count: number
}

export interface Document {
  id: number
  session_id: number
  filename: string
  original_filename: string
  file_type: string
  upload_date: string
  effective_date: string
  creation_date: string
  processing_status: string
}

export interface RBIClause {
  id: number
  clause_text: string
  predefined_meaning: string | null
  category: string | null
  ai_understanding: string | null
}

export interface ComplianceResult {
  id: number
  document_id: number
  rbi_clause_id: number
  compliance_status: 'Compliant' | 'Non-Compliant' | 'Review'
  risk_score: number
  agreement_reference: string | null
  ai_understanding_agreement: string | null
  ai_understanding_rbi: string | null
  rbi_clause?: RBIClause
}

export interface SessionDetail {
  id: number
  title: string
  created_at: string
  status: string
  documents: Document[]
}

export interface HealthStatus {
  status: string
  ollama_connected: boolean
  ollama_url: string
}

export const apiClient = {
  health: (): Promise<HealthStatus> =>
    api.get('/health').then(r => r.data),

  listSessions: (): Promise<AnalysisSession[]> =>
    api.get('/analysis/').then(r => r.data),

  createSession: (title: string): Promise<AnalysisSession> =>
    api.post('/analysis/create', { title }).then(r => r.data),

  getSession: (id: number): Promise<SessionDetail> =>
    api.get(`/analysis/${id}`).then(r => r.data),

  deleteSession: (id: number): Promise<void> =>
    api.delete(`/analysis/${id}`).then(r => r.data),

  getDocumentResults: (sessionId: number, documentId: number): Promise<ComplianceResult[]> =>
    api.get(`/analysis/${sessionId}/documents/${documentId}/results`).then(r => r.data),

  getRBIClauses: (sessionId: number): Promise<RBIClause[]> =>
    api.get(`/analysis/${sessionId}/rbi-clauses`).then(r => r.data),

  uploadDocument: (
    sessionId: number,
    file: File,
    fileType: string,
    effectiveDate?: string,
    creationDate?: string
  ): Promise<{ document_id: number; effective_date: string; creation_date: string; processing_status: string }> => {
    const formData = new FormData()
    formData.append('session_id', String(sessionId))
    formData.append('file', file)
    formData.append('file_type', fileType)
    if (effectiveDate) formData.append('effective_date', effectiveDate)
    if (creationDate) formData.append('creation_date', creationDate)
    return api.post('/document/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(r => r.data)
  },

  getDocumentStatus: (documentId: number): Promise<{ document_id: number; status: string }> =>
    api.get(`/document/${documentId}/status`).then(r => r.data),

  updateDocumentDates: (
    documentId: number,
    effectiveDate?: string,
    creationDate?: string
  ): Promise<void> => {
    const params: Record<string, string> = {}
    if (effectiveDate) params.effective_date = effectiveDate
    if (creationDate) params.creation_date = creationDate
    return api.patch(`/document/${documentId}/dates`, null, { params }).then(r => r.data)
  },

  deleteDocument: (documentId: number): Promise<void> =>
    api.delete(`/document/${documentId}`).then(r => r.data),

  getReportUrl: (sessionId: number): string =>
    `/api/report/${sessionId}`,

  getDocumentReportUrl: (sessionId: number, documentId: number): string =>
    `/api/report/${sessionId}/document/${documentId}`,
}

export default apiClient

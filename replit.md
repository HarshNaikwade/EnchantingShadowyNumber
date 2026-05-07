# RBI Compliance Checker

## Overview
A professional full-stack monorepo for analysing legal agreements (PDF/DOCX) against RBI (Reserve Bank of India) compliance standards using a locally or cloud-hosted AI model (Ollama / Groq).

## Architecture

### Backend (Python FastAPI)
- **Port:** 8000
- **Location:** `apps/backend/`
- **Database:** SQLite (`apps/backend/compliance_checker.db`) — forced, ignores DATABASE_URL env var
- **AI:** Ollama at `http://localhost:11434` (default) or Groq cloud — runtime switchable
- **File Storage:** `uploads/` (project root)

### Frontend (React + Vite)
- **Port:** 5000
- **Location:** `apps/frontend/`
- **Proxies:** `/api/*` → `http://localhost:8000`
- **Packages:** Root `node_modules/` (Vite invoked as `node ../../node_modules/.bin/vite`)

## Tech Stack
- **Frontend:** React 18 + Vite 5 + Tailwind CSS v4 + Radix UI + TanStack Query
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy + SQLite + Pydantic v2
- **Document Parsing:** pdfplumber + python-docx + pytesseract (OCR)
- **AI:** Ollama (llama3 / mistral) or Groq API (llama3-70b-8192)
- **PDF Reports:** reportlab

## Key Files

### Backend
- `apps/backend/main.py` — FastAPI app entry point with lifespan + DB seeding
- `apps/backend/core/config.py` — Centralised paths, UPLOAD_DIR, DATABASE_URL (forced SQLite)
- `apps/backend/core/log_buffer.py` — In-memory log ring-buffer
- `apps/backend/core/progress.py` — Per-document AI progress tracker
- `apps/backend/core/runtime_config.py` — JSON-persisted runtime settings (provider, ollama URL)
- `apps/backend/db/session.py` — SQLAlchemy engine + SessionLocal + get_db
- `apps/backend/db/models.py` — ORM models (AnalysisSession, Document, RBIClause, ComplianceResult)
- `apps/backend/db/seed_data.py` — 7 default RBI compliance clauses
- `apps/backend/services/ai/analyzer.py` — Ollama/Groq API calls + JSON prompt templates
- `apps/backend/services/parsing/parser.py` — PDF/DOCX text extraction + date regex + OCR
- `apps/backend/api/routes/analysis.py` — Session CRUD endpoints
- `apps/backend/api/routes/documents.py` — Document upload + AI analysis background task
- `apps/backend/api/routes/reports.py` — PDF report generation via reportlab
- `apps/backend/api/routes/clauses.py` — RBI clause CRUD + AI understanding trigger
- `apps/backend/api/routes/settings.py` — Runtime provider/URL config
- `apps/backend/api/routes/debug.py` — Log streaming endpoint
- `apps/backend/api/routes/dev.py` — DEV-only document parse inspector

### Frontend
- `apps/frontend/src/lib/api.ts` — Typed axios API client
- `apps/frontend/src/features/sessions/SessionsPage.tsx` — Sessions dashboard
- `apps/frontend/src/features/documents/WorkspacePage.tsx` — Upload + compliance tables
- `apps/frontend/src/features/compliance/ComplianceTables.tsx` — 3 sortable/searchable tables
- `apps/frontend/src/features/clauses/ClausesPage.tsx` — RBI clause settings
- `apps/frontend/src/components/OllamaWarning.tsx` — AI status bar with inline URL editor
- `apps/frontend/src/components/DevToolsPanel.tsx` — DEV-only full-screen debug overlay

### Infrastructure
- `scripts/setup.py` — One-command dependency install
- `scripts/dev.py` — Start backend + frontend in parallel
- `scripts/healthcheck.py` — Backend + AI connectivity probe
- `scripts/seed_db.py` — Manually seed RBI clauses
- `shared/constants/__init__.py` — Shared Python constants
- `shared/types/index.ts` — Shared TypeScript types
- `docker-compose.yml` — Docker Compose for production-style deployment
- `.env.example` — Environment variable reference

## Workflows
- **Start application** — `cd apps/frontend && node ../../node_modules/.bin/vite --port 5000 --host 0.0.0.0`
- **Backend API** — `cd apps/backend && python main.py`

## Database Schema
- `AnalysisSession` — id, title, created_at, status
- `Document` — id, session_id, file_type, upload_date, filename, original_filename, effective_date, creation_date, extracted_text, processing_status
- `RBIClause` — id, clause_text, predefined_meaning, category, ai_understanding
- `ComplianceResult` — id, document_id, rbi_clause_id, compliance_status, risk_score, agreement_reference, ai_understanding_agreement, ai_understanding_rbi

## API Endpoints
- `GET /api/health` — Backend + AI connectivity
- `GET /api/analysis/` — List all sessions
- `POST /api/analysis/create` — Create session
- `GET /api/analysis/{id}` — Get session with documents
- `DELETE /api/analysis/{id}` — Delete session
- `POST /api/document/upload` — Upload document (triggers AI analysis)
- `GET /api/document/{id}/status` — Poll processing status
- `GET /api/document/{id}/progress` — Live AI step progress
- `POST /api/document/{id}/rerun` — Re-run AI analysis
- `PATCH /api/document/{id}/dates` — Update effective/creation dates
- `DELETE /api/document/{id}` — Delete document
- `GET /api/clauses/` — List RBI clauses
- `POST /api/clauses/` — Create RBI clause
- `PUT /api/clauses/{id}` — Update RBI clause
- `DELETE /api/clauses/{id}` — Delete RBI clause
- `POST /api/clauses/analyze` — Trigger AI understanding for all clauses
- `GET /api/report/{session_id}` — Full session PDF report
- `GET /api/report/{session_id}/document/{doc_id}` — Per-document PDF report
- `GET /api/settings/provider` — Get active AI provider
- `POST /api/settings/provider` — Switch AI provider
- `GET /api/settings/ollama-url` — Get Ollama URL
- `POST /api/settings/ollama-url` — Update Ollama URL
- `GET /api/debug/logs` — Stream backend logs

## Important Notes
- Database always uses SQLite (ignores any DATABASE_URL env var from Replit)
- OCR requires tesseract-ocr system dependency (auto-installed via Nix)
- AI analysis runs as a background task after document upload
- If AI provider is not connected, documents are parsed but compliance analysis is skipped
- All 7 default RBI clauses are seeded automatically on first startup
- Uploads stored in `uploads/` at project root (shared between backend + scripts)
- Runtime config (AI provider, Ollama URL) persisted in `apps/backend/core/runtime_config.json`

## User Preferences
- Keep code in professional monorepo structure (`apps/backend/`, `apps/frontend/`)
- Service layer pattern: core/, db/, services/ai/, services/parsing/ in backend
- Feature-based frontend: features/sessions/, features/documents/, features/compliance/, features/clauses/

# RBI Compliance Checker

## Overview
A full-stack web application for analyzing legal agreements (PDF/Word) against RBI (Reserve Bank of India) compliance standards using a locally hosted AI model (Ollama).

## Architecture

### Backend (Python FastAPI)
- **Port:** 8000
- **Location:** `backend/`
- **Database:** SQLite (`backend/compliance_checker.db`)
- **AI:** Ollama API at `http://localhost:11434`
- **File Storage:** `backend/uploads/`

### Frontend (React + Vite)
- **Port:** 5000
- **Location:** `frontend/`
- **Proxies:** `/api/*` → `http://localhost:8000`
- **Packages:** In root `node_modules/` (found by Vite's module resolution)

## Tech Stack
- **Frontend:** React 18 + Vite 5 + Tailwind CSS v4 + Radix UI
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy + SQLite
- **Document Parsing:** pdfplumber + python-docx + pytesseract (OCR)
- **AI:** Ollama (llama3 or mistral model)
- **PDF Reports:** reportlab

## Key Files
- `backend/main.py` — FastAPI application entry point with lifespan + seeding
- `backend/models.py` — SQLAlchemy models (AnalysisSession, Document, RBIClause, ComplianceResult)
- `backend/database.py` — SQLite engine (forced, ignores DATABASE_URL env var)
- `backend/document_parser.py` — PDF/DOCX text extraction + date regex extraction
- `backend/ai_analyzer.py` — Ollama API calls + JSON prompt templates
- `backend/seed_data.py` — 7 default RBI compliance clauses
- `backend/routes/analysis.py` — Session CRUD endpoints
- `backend/routes/documents.py` — Document upload + AI analysis background task
- `backend/routes/reports.py` — PDF report generation via reportlab
- `frontend/src/lib/api.ts` — Typed API client (axios)
- `frontend/src/pages/Dashboard.tsx` — Sessions list page
- `frontend/src/pages/AnalysisWorkspace.tsx` — Upload + compliance tables page
- `frontend/src/components/ComplianceTables.tsx` — 3 compliance tables (sortable + searchable)

## Workflows
- **Start application** — `cd frontend && node ../node_modules/.bin/vite --port 5000 --host 0.0.0.0`
- **Backend API** — `cd backend && python main.py`

## Database Schema
- `AnalysisSession` — id, title, created_at, status
- `Document` — id, session_id, file_type, upload_date, filename, effective_date, creation_date
- `RBIClause` — id, clause_text, predefined_meaning, category, ai_understanding
- `ComplianceResult` — id, document_id, rbi_clause_id, compliance_status, risk_score, agreement_reference, ai_understanding_agreement, ai_understanding_rbi

## API Endpoints
- `GET /api/health` — Check backend + Ollama connectivity
- `GET /api/analysis/` — List all sessions
- `POST /api/analysis/create` — Create a new session
- `GET /api/analysis/{id}` — Get session with documents
- `DELETE /api/analysis/{id}` — Delete session
- `POST /api/document/upload` — Upload document (triggers AI analysis as background task)
- `GET /api/document/{id}/status` — Poll document processing status
- `PATCH /api/document/{id}/dates` — Manually update effective/creation dates
- `DELETE /api/document/{id}` — Delete document
- `GET /api/report/{session_id}` — Download full session PDF report
- `GET /api/report/{session_id}/document/{doc_id}` — Download per-document PDF report

## Local Development
1. Install Ollama from https://ollama.ai
2. Run `ollama pull llama3`
3. Run `ollama serve`
4. Install Python deps: `pip install -r requirements.txt`
5. Start backend: `cd backend && python main.py`
6. Install Node deps: `npm install`
7. Start frontend: `cd frontend && npm run dev`

## Important Notes
- Database always uses SQLite (ignores any DATABASE_URL env var from Replit)
- OCR requires tesseract-ocr system dependency (auto-installed via Nix)
- AI analysis runs as a background task after document upload
- If Ollama is not connected, documents are still parsed but compliance analysis is skipped
- All 7 default RBI clauses are seeded automatically on first startup

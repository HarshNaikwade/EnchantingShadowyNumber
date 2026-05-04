# RBI Compliance Checker

A full-stack application that analyzes legal agreements (PDF/DOCX) against RBI compliance standards using a locally hosted AI model (Ollama). It stores sessions, extracted text, and compliance results in SQLite, and presents results in a searchable UI.

## What this project is

This tool helps compliance teams and legal reviewers compare agreement clauses with RBI requirements and produce a structured compliance report. It is designed for local-first use, keeping documents and AI processing on the same machine.

## What we are trying to achieve

- Parse and normalize agreement documents (PDF/DOCX, with OCR fallback).
- Extract agreement clauses into structured data.
- Generate AI understanding of RBI clauses.
- Compare agreement clauses to RBI clauses and produce compliance judgments.
- Provide a searchable, exportable compliance report for each document and session.

## How it works (end-to-end)

1. User creates an analysis session in the UI.
2. User uploads a PDF/DOCX document and selects a document type (Agreement, Addendum, etc.).
3. Backend parses the document, extracts text and dates, and stores it in SQLite.
4. A background task runs AI analysis:
   - Step 1: Analyze RBI clauses and generate AI understanding (stored in RBIClause.ai_understanding).
   - Step 2: Extract agreement clauses from the document text.
   - Step 3: Compare agreement clauses to each RBI clause and store compliance results.
5. UI polls document status and renders three tables:
   - RBI clauses and their AI understanding.
   - Agreement clause analysis.
   - Compliance report (status and risk score).
6. User can download a PDF report per document or per session.

## Architecture

### Backend (FastAPI)
- Location: backend/
- Port: 8000
- DB: SQLite (compliance_checker.db)
- AI: Ollama HTTP API (default http://localhost:11434)
- File storage: uploads/

### Frontend (React + Vite)
- Location: frontend/
- Port: 5000
- Uses /api proxy to talk to backend

## Tech stack

Frontend:
- React 18, Vite 5, TypeScript 5
- TanStack Query, Axios
- Tailwind CSS v4, Radix UI

Backend:
- Python 3
- FastAPI, Uvicorn, SQLAlchemy
- SQLite
- pdfplumber, python-docx, pytesseract, pdf2image (OCR)
- reportlab (PDF exports)
- httpx (Ollama requests)

AI:
- Ollama local model server
- Model configurable via OLLAMA_MODEL (fallback to first available model)

## Key API endpoints

- GET /api/health
- POST /api/analysis/create
- GET /api/analysis/{id}
- POST /api/document/upload
- GET /api/document/{id}/status
- POST /api/document/{id}/rerun
- POST /api/clauses/analyze
- GET /api/report/{session_id}
- GET /api/report/{session_id}/document/{document_id}

## Local development

Prerequisites:
- Python 3
- Node.js
- Ollama installed and running

1) Install and run Ollama
- Install from https://ollama.ai
- Pull a model, for example:
  - ollama pull gemma4
- Start server:
  - ollama serve

2) Backend setup
- cd backend
- pip install -r requirements.txt
- python main.py

3) Frontend setup
- cd frontend
- npm install
- npm run dev

Open:
- Frontend: http://localhost:5000
- Backend: http://localhost:8000

## Configuration

Environment variables (optional):
- OLLAMA_BASE_URL (default: http://localhost:11434)
- OLLAMA_MODEL (default: llama3)
- BACKEND_PORT (default: 8000)
- FRONTEND_ORIGINS (default: http://localhost:5000)
- UPLOAD_DIR (default: ./uploads)
- MAX_UPLOAD_MB (default: 50)

## Limitations

- OCR accuracy depends on scan quality and Tesseract availability.
- Clause extraction relies on prompt-based parsing, which can be brittle for long or unusual documents.
- Only PDF and DOCX are supported by default.
- AI analysis is best-effort and may return partial or generic results.
- SQLite is single-user and not ideal for multi-tenant or high-concurrency deployments.
- No authentication/authorization is included.
- No incremental analysis: each re-run recomputes results for the document.

## Improvements (recommended next steps)

AI pipeline:
- Add chunking and section-level analysis for large documents.
- Add evaluation steps (confidence scores, evidence citations).
- Cache and reuse clause understanding per category/version.

Data and scalability:
- Add Postgres support with migrations.
- Add background job queue (Celery/RQ/Arq) for long-running tasks.
- Store model, prompt version, and timestamps for traceability.

Product and UX:
- Add re-run and clause analysis buttons in the UI.
- Add progress and logs for each AI step.
- Add a clause mapping view (RBI clause -> matching agreement clause).

Quality and safety:
- Add validation tests for parser outputs and AI JSON schemas.
- Add structured error reporting and retry logic for AI calls.
- Add auth and role-based access control if used beyond local dev.

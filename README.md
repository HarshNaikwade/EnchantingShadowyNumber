# RBI Compliance Checker

A professional full-stack application for analysing legal agreements (PDF / DOCX) against Reserve Bank of India (RBI) compliance standards using a locally or cloud-hosted AI model.

## Features

- Upload PDF and DOCX legal agreements
- Automatic AI-powered compliance analysis against 7 default RBI clauses (fully editable)
- Supports **Ollama** (local, private) and **Groq** (cloud, fast) — switchable at runtime
- Three-table compliance report: RBI Clauses · Agreement Understanding · Compliance Status
- Downloadable PDF reports per document or per session
- Real-time AI progress tracking during analysis
- Dev tools panel with full document parse inspector

---

## Project Structure

```
apps/
  backend/           FastAPI + SQLAlchemy service (Python 3.11)
    api/routes/      HTTP route handlers
    core/            Config, log-buffer, progress, runtime-config
    db/              SQLAlchemy session, models, seed data
    services/ai/     Ollama / Groq AI calls
    services/parsing/ PDF / DOCX text extraction + OCR
  frontend/          React 18 + Vite 5 application (TypeScript)
    src/features/    Feature-based page components
    src/components/  Shared UI primitives (shadcn/ui)
    src/lib/         Typed API client, utilities
shared/              Cross-cutting constants and TypeScript types
scripts/             setup.py · dev.py · healthcheck.py · seed_db.py
docs/                Architecture documentation
uploads/             Document storage (auto-created, gitignored)
logs/                Application logs (auto-created, gitignored)
```

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown.

---

## Quick Start

### 1. Install dependencies

```bash
python scripts/setup.py
```

### 2. Configure AI provider

**Option A — Ollama (local, recommended)**
```bash
# Install from https://ollama.ai, then:
ollama pull llama3
ollama serve
```

**Option B — Groq (cloud)**
```bash
cp .env.example .env
# Set GROQ_API_KEY and AI_PROVIDER=groq in .env
```

### 3. Start development servers

```bash
python scripts/dev.py
```

- Frontend: http://localhost:5000  
- Backend API: http://localhost:8000  
- API docs: http://localhost:8000/docs

### 4. Health check

```bash
python scripts/healthcheck.py
```

---

## Docker

```bash
docker-compose up --build
```

---

## How It Works

1. User creates an analysis session in the UI.
2. User uploads a PDF/DOCX document and selects a document type.
3. Backend parses the document, extracts text and dates, stores it in SQLite.
4. A background task runs AI analysis:
   - Step 1: Analyse RBI clauses and generate AI understanding.
   - Step 2: Extract agreement clauses from the document text.
   - Step 3: Compare agreement clauses to each RBI clause; store compliance results.
5. UI polls document status and renders three compliance tables.
6. User downloads a PDF report per document or per session.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Backend + AI connectivity |
| GET | `/api/analysis/` | List all sessions |
| POST | `/api/analysis/create` | Create session |
| GET | `/api/analysis/{id}` | Session detail with documents |
| DELETE | `/api/analysis/{id}` | Delete session |
| POST | `/api/document/upload` | Upload document (triggers AI) |
| GET | `/api/document/{id}/status` | Poll processing status |
| GET | `/api/document/{id}/progress` | Live AI step progress |
| POST | `/api/document/{id}/rerun` | Re-run AI analysis |
| PATCH | `/api/document/{id}/dates` | Update effective / creation date |
| DELETE | `/api/document/{id}` | Delete document |
| GET | `/api/clauses/` | List RBI clauses |
| POST | `/api/clauses/` | Create RBI clause |
| PUT | `/api/clauses/{id}` | Update RBI clause |
| DELETE | `/api/clauses/{id}` | Delete RBI clause |
| POST | `/api/clauses/analyze` | Re-generate AI understanding |
| GET | `/api/report/{session_id}` | Full session PDF report |
| GET | `/api/report/{session_id}/document/{doc_id}` | Per-document PDF |
| GET | `/api/settings/provider` | Get active AI provider |
| POST | `/api/settings/provider` | Switch AI provider |
| GET | `/api/settings/ollama-url` | Get Ollama URL |
| POST | `/api/settings/ollama-url` | Update Ollama URL |
| GET | `/api/debug/logs` | Tail backend logs |

---

## Configuration

Copy `.env.example` to `.env` and adjust values.

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `8000` | FastAPI listen port |
| `AI_PROVIDER` | `ollama` | `ollama` or `groq` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `GROQ_API_KEY` | — | Groq API key |
| `MAX_UPLOAD_MB` | `50` | Max file upload size |
| `UPLOAD_DIR` | `<root>/uploads` | Document storage path |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS v4, Radix UI |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Pydantic v2 |
| Database | SQLite |
| AI — local | Ollama (llama3 / mistral) |
| AI — cloud | Groq API (llama3-70b-8192) |
| Document parsing | pdfplumber, python-docx, pytesseract (OCR) |
| Reports | reportlab |

---

## Limitations

- OCR accuracy depends on scan quality and Tesseract availability.
- Clause extraction relies on prompt-based parsing; may be brittle for unusual documents.
- Only PDF and DOCX are supported.
- SQLite is single-user and not suited for high-concurrency deployments.
- No authentication or authorisation is included.

# Architecture

## Overview

RBI Compliance Checker is a monorepo full-stack application that analyses PDF/DOCX legal agreements against Reserve Bank of India (RBI) compliance standards using a locally or cloud-hosted AI model.

## Directory Layout

```
/
├── apps/
│   ├── backend/                  # FastAPI application (Python 3.11)
│   │   ├── api/
│   │   │   └── routes/           # HTTP route handlers
│   │   │       ├── analysis.py   # Session CRUD
│   │   │       ├── clauses.py    # RBI clause management
│   │   │       ├── documents.py  # Upload + AI analysis trigger
│   │   │       ├── reports.py    # PDF report generation
│   │   │       ├── settings.py   # Runtime AI provider config
│   │   │       ├── debug.py      # Log streaming
│   │   │       └── dev.py        # DEV-only parse inspector
│   │   ├── core/
│   │   │   ├── config.py         # Centralised paths & env config
│   │   │   ├── log_buffer.py     # In-memory log ring-buffer
│   │   │   ├── progress.py       # Per-document AI progress tracker
│   │   │   └── runtime_config.py # JSON-persisted runtime settings
│   │   ├── db/
│   │   │   ├── session.py        # SQLAlchemy engine + SessionLocal
│   │   │   ├── models.py         # ORM models
│   │   │   └── seed_data.py      # Default RBI clauses seed
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   └── analyzer.py   # Ollama / Groq AI calls
│   │   │   └── parsing/
│   │   │       └── parser.py     # PDF / DOCX text extraction + OCR
│   │   ├── workers/              # Reserved for Celery / async workers
│   │   ├── utils/                # Shared utility helpers
│   │   ├── tests/                # Backend test suite
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── frontend/                 # React + Vite application (TypeScript)
│       ├── src/
│       │   ├── features/
│       │   │   ├── sessions/     # Dashboard / session list
│       │   │   ├── documents/    # Upload workspace
│       │   │   ├── compliance/   # Compliance tables component
│       │   │   └── clauses/      # RBI clause settings
│       │   ├── components/
│       │   │   └── ui/           # shadcn/ui primitives
│       │   ├── lib/
│       │   │   ├── api.ts        # Typed axios API client
│       │   │   ├── utils.ts      # cn() helper
│       │   │   └── debugLogger.ts
│       │   ├── services/
│       │   │   └── api.ts        # Re-export facade
│       │   ├── types/
│       │   │   └── index.ts      # Shared TypeScript types
│       │   ├── App.tsx           # React Router setup
│       │   └── main.tsx          # Vite entry point
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── Dockerfile
│
├── shared/
│   ├── constants/                # Python constants shared across scripts
│   └── types/                    # TypeScript types mirroring backend enums
│
├── scripts/
│   ├── setup.py                  # One-command dependency install
│   ├── dev.py                    # Start both services in parallel
│   ├── healthcheck.py            # Backend + AI connectivity probe
│   └── seed_db.py                # Manually seed RBI clauses
│
├── uploads/                      # Document storage (gitignored)
├── logs/                         # Application logs (gitignored)
├── docs/                         # Project documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

## Request Flow

```
Browser
  │
  ├─ GET /api/analysis/          ──► analysis.py ──► db/session.py ──► SQLite
  │
  ├─ POST /api/document/upload   ──► documents.py
  │     │  (sync: parse file)         └─ services/parsing/parser.py
  │     └─ (async background task)
  │           └─ services/ai/analyzer.py ──► Ollama / Groq API
  │                 └─ db/models.py (ComplianceResult)
  │
  └─ GET /api/report/{id}        ──► reports.py ──► reportlab PDF
```

## AI Provider Architecture

Runtime provider switching is handled via `core/runtime_config.py` which persists settings to `runtime_config.json`. The frontend reads the active provider from `GET /api/settings/provider` and displays it in the status bar.

| Provider | Config key    | Default model     |
|----------|---------------|-------------------|
| Ollama   | `ollama`      | `llama3`          |
| Groq     | `groq`        | `llama3-70b-8192` |

## Database

SQLite via SQLAlchemy. File is stored at `apps/backend/compliance_checker.db`. Tables:

- `analysis_sessions` — top-level work units
- `documents` — uploaded files with extracted text
- `rbi_clauses` — configurable compliance rules (7 seeded by default)
- `compliance_results` — per-document-per-clause AI verdicts

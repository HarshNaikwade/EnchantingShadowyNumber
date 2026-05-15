# RBI Compliance Checker - Project Guide

## Quick Start

```bash
python start.py setup
python start.py dev
```

- Frontend: `http://localhost:5000`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

## Main Commands

Use `start.py` as the single entrypoint:

```bash
python start.py setup       # Create .venv and install dependencies
python start.py dev         # Start backend + frontend (auto setup if needed)
python start.py update      # Update Python and Node dependencies
python start.py health      # Run health checks
python start.py docker-up   # Start containers with docker compose
python start.py docker-down # Stop containers
```

## Current Project Structure

```text
EnchantingShadowyNumber/
	start.py
	PROJECT.md
	README.md
	docker-compose.yml
	pyproject.toml
	package.json
	.env.example

	scripts/
		setup.py
		dev.py
		update-deps.py
		healthcheck.py

	apps/
		backend/
			main.py
			requirements.txt
			Dockerfile
			api/routes/
			core/
			db/
			services/
			uploads/

		frontend/
			Dockerfile
			index.html
			src/
				App.tsx
				index.css
				components/
				features/
				lib/
				types/

	docs/
		architecture.md

	uploads/
	logs/
```

## Notes

- Python dependencies are installed from `apps/backend/requirements.txt`.
- Dependencies are intentionally unpinned to fetch latest compatible releases at install/update time.
- SQLite DB files and generated runtime assets are gitignored.
- `.gitkeep` files preserve empty runtime directories in git.

## Docker

Use compose for containerized run:

```bash
docker compose up --build
```

- Frontend (nginx): `http://localhost:5000`
- Backend: `http://localhost:8000`

To stop:

```bash
docker compose down
```

- **Frontend UI**: http://localhost:5000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Stopping

Press **Ctrl+C** to stop all services

---

## 💻 Development Workflow

### 1. Backend Development

The backend auto-reloads on file changes thanks to Uvicorn's `--reload` flag.

```bash
# Files are in apps/backend/
# Main entry: main.py
# API routes: api/routes/*.py
# Services: services/
# Database models: db/models.py

# Make changes and save - backend reloads automatically
```

### 2. Frontend Development

The frontend auto-reloads on file changes thanks to Vite.

```bash
# Files are in apps/frontend/src/
# Components: components/
# Features: features/
# Utilities: lib/

# Make changes and save - page refreshes automatically
```

### 3. Database Changes

Update models in `apps/backend/db/models.py`:

- SQLAlchemy will recreate tables on next startup
- Run seed script if needed: `python scripts/seed_db.py`

### 4. Adding Dependencies

**Python packages:**

```bash
# Add to apps/backend/requirements.txt
# Then run:
python scripts/update-deps.py
```

**Node packages:**

```bash
cd apps/frontend
npm install package-name
# Then run:
cd ../.. && python scripts/update-deps.py
```

---

## ⚙️ Configuration & Environment

### Environment Variables

Create `.env` file in project root:

```bash
# AI Provider Configuration
AI_PROVIDER=ollama              # ollama, lmstudio, or groq
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://localhost:1234
GROQ_API_KEY=

# Development
ENABLE_DEV_ROUTES=false         # Set to true to enable /api/dev/* endpoints
DEBUG=true                      # Enable debug logging

# Database
DATABASE_URL=sqlite:///./test.db

# Server
HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_PORT=5000
```

### AI Provider Setup

#### Option 1: Ollama (Local, Free)

```bash
# Install from https://ollama.ai
# Run in terminal:
ollama serve

# In another terminal:
ollama pull llama2  # or mistral, neural-chat, etc.

# Set .env:
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

#### Option 2: LMStudio (Local, Free)

```bash
# Download from https://lmstudio.ai
# Start server (server mode in app)
# Default runs on http://localhost:1234

# Set .env:
AI_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234
```

#### Option 3: Groq (Cloud, Fast, Free)

```bash
# Get API key from https://console.groq.com
# Set .env:
AI_PROVIDER=groq
GROQ_API_KEY=your-api-key-here
```

---

## ✨ Code Quality Improvements

### Recent Refactoring (Completed)

#### 1. Consolidated Progress Tracking

- **Before**: 3 separate progress modules causing confusion
- **After**: Single unified `progress_manager.py`
- **Result**: -67% code duplication

#### 2. Secured Dev Routes

- **Before**: Development endpoints always accessible
- **After**: Protected by `ENABLE_DEV_ROUTES` environment variable
- **Result**: Production-safe default (disabled)

#### 3. Cleaned Frontend Dependencies

- **Before**: 29 npm packages including 6 unused
- **After**: 23 verified packages
- **Result**: -20% smaller bundle size

#### 4. Enhanced TypeScript Strictness

- **Before**: Unused variables/imports not detected
- **After**: Strict checking enabled
- **Result**: Dead code caught at compile time

#### 5. Removed Dead Code

- Deleted unused re-export layers
- Consolidated imports
- Removed old modules

### Code Organization

```
✓ Clear separation of concerns (api, services, db, core)
✓ Modular architecture with single-responsibility principle
✓ Type-safe TypeScript frontend
✓ Well-documented API endpoints
✓ Unified progress tracking system
✓ Simplified dependency management
```

---

## 🐛 Troubleshooting

### Virtual Environment Issues

```bash
# Recreate virtual environment
python start.py setup

# Or manually:
rm -rf .venv              # macOS/Linux
rmdir /s .venv            # Windows (in PowerShell)
python start.py setup
```

### Dependency Conflicts

```bash
# Force update all dependencies
python start.py update

# Or manually:
python -m pip install --upgrade -r apps/backend/requirements.txt
cd apps/frontend && npm update
```

### Services Not Starting

```bash
# Check health
python scripts/healthcheck.py

# Check logs
tail -f logs/*.log         # macOS/Linux
type logs/*.log | tail     # Windows PowerShell
```

### Backend Not Responding

```bash
# Make sure no other process uses port 8000
netstat -ano | findstr :8000  # Windows
lsof -i :8000               # macOS/Linux

# If needed, kill process:
taskkill /PID <PID> /F      # Windows
kill -9 <PID>               # macOS/Linux
```

### Frontend Not Compiling

```bash
# Check Node.js version
node --version              # Should be 18+
npm --version               # Should be 9+

# Clear cache and reinstall
cd apps/frontend
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

```bash
# Reset database
rm apps/backend/test.db

# Reseed with sample data
python scripts/seed_db.py
```

### Ollama Not Found

```bash
# Install Ollama from https://ollama.ai
# Run Ollama server:
ollama serve

# Pull a model:
ollama pull llama2
```

---

## 📚 API Documentation

### Interactive Documentation

After starting the project, visit: **http://localhost:8000/docs**

### Main Endpoints

#### Documents

- `POST /api/document/upload` - Upload document for analysis
- `GET /api/document/{id}/status` - Get document status
- `GET /api/document/{id}/progress/stream` - Stream analysis progress
- `PATCH /api/document/{id}/dates` - Update document dates
- `POST /api/document/{id}/rerun` - Re-analyze document

#### Clauses

- `GET /api/clauses/` - Get all RBI clauses
- `POST /api/clauses/` - Create new clause
- `PUT /api/clauses/{id}` - Update clause
- `DELETE /api/clauses/{id}` - Delete clause
- `POST /api/clauses/analyze` - Analyze document against clauses
- `GET /api/clauses/progress` - Get analysis progress

#### Settings

- `GET /api/settings/` - Get current settings
- `POST /api/settings/` - Update settings
- `GET /api/settings/ai-providers` - Get available AI providers

#### Analysis

- `POST /api/analysis/document` - Start document analysis
- `GET /api/analysis/results/{id}` - Get analysis results

---

## 📦 Dependency Management

### Automatic Updates

Dependencies are **automatically updated** every time you run:

- `python start.py` (all scenarios)
- `python start.py setup`
- `python start.py update`

### Manual Update

```bash
python scripts/update-deps.py
```

### Dependencies

**Python (Backend)**

- FastAPI 0.136.0 - Web framework
- Uvicorn 0.44.0 - ASGI server
- SQLAlchemy 2.0.41 - ORM
- Pydantic - Data validation
- pdfplumber - PDF parsing
- python-docx - DOCX parsing
- Pillow + pytesseract - OCR
- httpx - HTTP client

**Node.js (Frontend)**

- React 19 - UI framework
- TypeScript 6 - Type safety
- Vite 8 - Build tool
- React Router 7 - Navigation
- TanStack React Query 5 - Data fetching
- Radix UI - Component library
- Tailwind CSS 4 - Styling
- Axios - HTTP client
- Lucide React - Icons

---

## 🎯 Common Tasks

### Run Tests

```bash
cd apps/backend
python -m pytest
```

### Check Code Quality

```bash
cd apps/backend
python -m pylint main.py
python -m black --check .
```

### Build Frontend

```bash
cd apps/frontend
npm run build
```

### Check API Health

```bash
curl http://localhost:8000/docs
```

### View Database

```bash
sqlite3 test.db
.tables
.quit
```

### Enable Dev Endpoints

Set in `.env`:

```bash
ENABLE_DEV_ROUTES=true
```

Then access:

- `GET /api/dev/document/{id}/parsed` - See parsed document
- `POST /api/dev/rbi/analyze` - Test AI analysis

---

## 📧 Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs in `logs/` directory
3. Check API docs at `http://localhost:8000/docs`
4. Review application console output

---

## 🎉 You're Ready!

Run the project:

```bash
python start.py
```

Then visit: **http://localhost:5000**

Happy coding! 🚀

import os

_FILE = os.path.abspath(__file__)
BACKEND_DIR = os.path.dirname(os.path.dirname(_FILE))
ROOT_DIR = os.path.dirname(os.path.dirname(BACKEND_DIR))

DATABASE_URL = f"sqlite:///{os.path.join(BACKEND_DIR, 'compliance_checker.db')}"

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(ROOT_DIR, "uploads"))
LOG_DIR = os.path.join(ROOT_DIR, "logs")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5000")

# AI Provider Configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:latest")
LMSTUDIO_BASE_URL = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234")
LMSTUDIO_MODEL = os.getenv("LMSTUDIO_MODEL", "google/gemma-4-e4b")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

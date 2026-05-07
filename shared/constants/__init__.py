"""Shared constants used across backend and scripts."""

RBI_COMPLIANCE_STATUSES = ["Compliant", "Non-Compliant", "Review"]

ALLOWED_DOCUMENT_TYPES = ["Agreement", "Amendment", "Addendum", "MOU"]

ALLOWED_FILE_EXTENSIONS = [".pdf", ".docx"]

AI_PROVIDERS = ["ollama", "groq"]

DEFAULT_AI_PROVIDER = "ollama"
DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3"

DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_PORT = 5000
MAX_UPLOAD_MB = 50

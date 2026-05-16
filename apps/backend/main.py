import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Load .env file from project root
env_path = Path(__file__).parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from db.session import engine, Base, SessionLocal
from db.models import RBIClause
from api.routes import analysis, documents, reports, clauses, settings
from core.log_buffer import buffer_handler
from core.config import UPLOAD_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger().addHandler(buffer_handler)

os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up compliance checker API...")
    Base.metadata.create_all(bind=engine)
    
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="RBI Compliance Checker API",
    description="Local Agreement Compliance Checker against RBI Standards",
    version="2.0.0",
    lifespan=lifespan,
)

origins_env = os.getenv("FRONTEND_ORIGINS", "http://localhost:5000")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]
if origins_env.strip() == "*":
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(documents.router)
app.include_router(reports.router)
app.include_router(clauses.router)
app.include_router(settings.router)


@app.get("/api/health")
async def health_check():
    from services.ai.analyzer import (
        check_ai_connection,
        check_groq_connection,
        check_lmstudio_connection,
        check_ollama_connection,
        get_active_provider,
        get_ai_model,
        GROQ_MODEL,
        get_ollama_base_url,
        get_lmstudio_base_url,
    )

    provider = get_active_provider()
    ollama_connected = False
    lmstudio_connected = False
    groq_connected = False

    if provider == "ollama":
        ollama_connected = await check_ollama_connection()
        ai_connected = ollama_connected
    elif provider == "lmstudio":
        lmstudio_connected = await check_lmstudio_connection()
        ai_connected = lmstudio_connected
    elif provider == "groq":
        groq_connected = await check_groq_connection()
        ai_connected = groq_connected
    else:
        ai_connected = await check_ai_connection()
    return {
        "status": "ok",
        "ai_provider": provider,
        "ai_model": get_ai_model(),
        "ai_connected": ai_connected,
        "ollama_connected": ollama_connected,
        "ollama_url": get_ollama_base_url(),
        "lmstudio_connected": lmstudio_connected,
        "lmstudio_url": get_lmstudio_base_url(),
        "groq_connected": groq_connected,
        "groq_model": GROQ_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=True,
    )

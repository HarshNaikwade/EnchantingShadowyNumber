import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from models import RBIClause
from database import SessionLocal
from routes import analysis, documents, reports, clauses, debug
from log_buffer import buffer_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger().addHandler(buffer_handler)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up compliance checker API...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        count = db.query(RBIClause).count()
        if count == 0:
            from seed_data import seed_database
            seed_database()
            logger.info("Database seeded with default RBI clauses.")
        else:
            logger.info(f"Database has {count} RBI clauses.")
    finally:
        db.close()

    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="RBI Compliance Checker API",
    description="Local Agreement Compliance Checker against RBI Standards",
    version="1.0.0",
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
app.include_router(debug.router)


@app.get("/api/health")
async def health_check():
    from ai_analyzer import check_ai_connection, get_active_provider, get_ai_model
    ai_connected = await check_ai_connection()
    provider = get_active_provider()
    return {
        "status": "ok",
        "ai_provider": provider,
        "ai_connected": ai_connected,
        "ai_model": get_ai_model(),
        "ollama_connected": ai_connected if provider == "ollama" else False,
        "ollama_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=True,
    )

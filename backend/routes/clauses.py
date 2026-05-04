import logging
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import RBIClause, ComplianceResult
from ai_analyzer import (
    check_ollama_connection,
    generate_rbi_understanding,
    resolve_ollama_model,
    OLLAMA_MODEL,
)

router = APIRouter(prefix="/api/clauses", tags=["clauses"])
logger = logging.getLogger(__name__)


async def _run_rbi_clause_analysis_async(db_url: str, force: bool = False):
    """Background task: Generate AI understanding for RBI clauses."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        logger.info("Starting RBI clause analysis (force=%s)", force)
        is_connected = await check_ollama_connection()
        if not is_connected:
            logger.warning("Ollama not reachable, skipping RBI clause analysis")
            return

        resolved_model = await resolve_ollama_model(OLLAMA_MODEL)
        if not resolved_model:
            logger.warning("No Ollama models available, skipping RBI clause analysis")
            return

        clauses = db.query(RBIClause).all()
        if not clauses:
            logger.info("No RBI clauses found for analysis")
            return

        updated = 0
        for clause in clauses:
            if not force and clause.ai_understanding:
                continue
            understanding = await generate_rbi_understanding(
                clause.clause_text,
                clause.predefined_meaning,
                model=resolved_model
            )
            clause.ai_understanding = understanding
            updated += 1

        if updated:
            db.commit()
            logger.info("RBI clause analysis updated %s clauses.", updated)
        else:
            logger.info("RBI clause analysis skipped; nothing to update")
    except Exception:
        logger.exception("RBI clause analysis failed")
    finally:
        db.close()


def run_rbi_clause_analysis(db_url: str, force: bool = False):
    """Sync wrapper to run RBI clause analysis in background tasks."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(_run_rbi_clause_analysis_async(db_url, force))
    else:
        loop.create_task(_run_rbi_clause_analysis_async(db_url, force))


class RBIClauseCreate(BaseModel):
    clause_text: str
    predefined_meaning: Optional[str] = None
    category: Optional[str] = None


class RBIClauseUpdate(BaseModel):
    clause_text: Optional[str] = None
    predefined_meaning: Optional[str] = None
    category: Optional[str] = None


class RBIClauseResponse(BaseModel):
    id: int
    clause_text: str
    predefined_meaning: Optional[str]
    category: Optional[str]
    ai_understanding: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[RBIClauseResponse])
def list_clauses(db: Session = Depends(get_db)):
    return db.query(RBIClause).order_by(RBIClause.id).all()


@router.post("/analyze")
def analyze_clauses(
    background_tasks: BackgroundTasks,
    force: bool = False,
):
    from database import DATABASE_URL
    background_tasks.add_task(run_rbi_clause_analysis, DATABASE_URL, force)
    logger.info("Queued RBI clause analysis (force=%s)", force)
    return {"message": "RBI clause analysis queued", "force": force}


@router.post("/", response_model=RBIClauseResponse, status_code=201)
def create_clause(payload: RBIClauseCreate, db: Session = Depends(get_db)):
    clause = RBIClause(
        clause_text=payload.clause_text,
        predefined_meaning=payload.predefined_meaning,
        category=payload.category,
    )
    db.add(clause)
    db.commit()
    db.refresh(clause)
    logger.info("Created RBI clause %s", clause.id)
    return clause


@router.put("/{clause_id}", response_model=RBIClauseResponse)
def update_clause(clause_id: int, payload: RBIClauseUpdate, db: Session = Depends(get_db)):
    clause = db.query(RBIClause).filter(RBIClause.id == clause_id).first()
    if not clause:
        raise HTTPException(status_code=404, detail="RBI clause not found")
    if payload.clause_text is not None:
        clause.clause_text = payload.clause_text
    if payload.predefined_meaning is not None:
        clause.predefined_meaning = payload.predefined_meaning
    if payload.category is not None:
        clause.category = payload.category
    db.commit()
    db.refresh(clause)
    logger.info("Updated RBI clause %s", clause_id)
    return clause


@router.delete("/{clause_id}", status_code=204)
def delete_clause(clause_id: int, db: Session = Depends(get_db)):
    clause = db.query(RBIClause).filter(RBIClause.id == clause_id).first()
    if not clause:
        raise HTTPException(status_code=404, detail="RBI clause not found")
    db.query(ComplianceResult).filter(ComplianceResult.rbi_clause_id == clause_id).delete()
    db.delete(clause)
    db.commit()
    logger.info("Deleted RBI clause %s", clause_id)

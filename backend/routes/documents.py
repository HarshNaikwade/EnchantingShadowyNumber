import os
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import AnalysisSession, Document, ComplianceResult, RBIClause
from document_parser import parse_document
from ai_analyzer import (
    check_ollama_connection,
    extract_agreement_clauses,
    generate_rbi_understanding,
    check_compliance,
    resolve_ollama_model,
    OLLAMA_MODEL,
)

router = APIRouter(prefix="/api/document", tags=["documents"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


async def run_ai_analysis(document_id: int, db_url: str):
    """Background task: Run AI compliance analysis on a document."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        doc.processing_status = "processing"
        db.commit()

        if not doc.extracted_text:
            doc.processing_status = "failed"
            db.commit()
            return

        rbi_clauses = db.query(RBIClause).all()
        if not rbi_clauses:
            doc.processing_status = "completed"
            db.commit()
            return

        is_connected = await check_ollama_connection()
        if not is_connected:
            logger.warning("Ollama not reachable, skipping AI analysis")
            doc.processing_status = "completed_no_ai"
            db.commit()
            return

        resolved_model = await resolve_ollama_model(OLLAMA_MODEL)
        if not resolved_model:
            logger.warning("No Ollama models available, skipping AI analysis")
            doc.processing_status = "completed_no_ai"
            db.commit()
            return

        agreement_clauses = await extract_agreement_clauses(doc.extracted_text, model=resolved_model)

        for rbi_clause in rbi_clauses:
            if not rbi_clause.ai_understanding and rbi_clause.predefined_meaning:
                understanding = await generate_rbi_understanding(
                    rbi_clause.clause_text,
                    rbi_clause.predefined_meaning,
                    model=resolved_model
                )
                rbi_clause.ai_understanding = understanding
                db.commit()

        existing = db.query(ComplianceResult).filter(
            ComplianceResult.document_id == document_id
        ).first()
        if existing:
            db.query(ComplianceResult).filter(
                ComplianceResult.document_id == document_id
            ).delete()
            db.commit()

        for rbi_clause in rbi_clauses:
            result = await check_compliance(
                agreement_clauses,
                rbi_clause.clause_text,
                rbi_clause.id,
                doc.file_type,
                model=resolved_model
            )

            compliance = ComplianceResult(
                document_id=document_id,
                rbi_clause_id=rbi_clause.id,
                compliance_status=result["compliance_status"],
                risk_score=result["risk_score"],
                agreement_reference=result["agreement_reference"],
                ai_understanding_agreement=result["ai_understanding_agreement"],
                ai_understanding_rbi=result.get("ai_understanding_rbi", rbi_clause.ai_understanding),
            )
            db.add(compliance)

        db.commit()

        doc.processing_status = "completed"
        session = db.query(AnalysisSession).filter(AnalysisSession.id == doc.session_id).first()
        if session:
            session.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"AI analysis failed for document {document_id}: {e}")
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.processing_status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    session_id: int = Form(...),
    file_type: str = Form(...),
    effective_date: Optional[str] = Form(None),
    creation_date: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not allowed. Use PDF or DOCX."
        )
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file content type.")

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    total_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max size is {MAX_UPLOAD_MB} MB."
                    )
                f.write(chunk)
    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise

    parsed = parse_document(file_path, file.filename)

    doc = Document(
        session_id=session_id,
        file_type=file_type,
        filename=unique_filename,
        original_filename=file.filename,
        effective_date=effective_date or parsed["effective_date"],
        creation_date=creation_date or parsed["creation_date"],
        extracted_text=parsed["text"],
        processing_status="queued",
    )
    db.add(doc)
    session.status = "processing"
    db.commit()
    db.refresh(doc)

    from database import DATABASE_URL
    background_tasks.add_task(run_ai_analysis, doc.id, DATABASE_URL)

    return {
        "document_id": doc.id,
        "filename": file.filename,
        "effective_date": doc.effective_date,
        "creation_date": doc.creation_date,
        "word_count": parsed["word_count"],
        "processing_status": "queued",
        "message": "Document uploaded. AI analysis started in background."
    }


@router.patch("/{document_id}/dates")
def update_document_dates(
    document_id: int,
    effective_date: Optional[str] = None,
    creation_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if effective_date is not None:
        doc.effective_date = effective_date
    if creation_date is not None:
        doc.creation_date = creation_date
    db.commit()
    return {"message": "Dates updated successfully"}


@router.get("/{document_id}/status")
def get_document_status(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document_id": document_id, "status": doc.processing_status}


@router.post("/{document_id}/rerun")
def rerun_analysis(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text to analyze")

    doc.processing_status = "queued"
    session = db.query(AnalysisSession).filter(AnalysisSession.id == doc.session_id).first()
    if session:
        session.status = "processing"
    db.commit()

    from database import DATABASE_URL
    background_tasks.add_task(run_ai_analysis, doc.id, DATABASE_URL)

    return {"message": "AI analysis re-queued", "document_id": doc.id}


@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import AnalysisSession, Document, ComplianceResult, RBIClause

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


class CreateSessionRequest(BaseModel):
    title: str
    date: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    status: str
    document_count: int

    class Config:
        from_attributes = True


class DocumentSummary(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    upload_date: datetime
    effective_date: str
    creation_date: str
    processing_status: str

    class Config:
        from_attributes = True


class RBIClauseDetail(BaseModel):
    id: int
    clause_text: str
    predefined_meaning: Optional[str]
    category: Optional[str]
    ai_understanding: Optional[str]

    class Config:
        from_attributes = True


class ComplianceResultDetail(BaseModel):
    id: int
    document_id: int
    rbi_clause_id: int
    compliance_status: str
    risk_score: float
    agreement_reference: Optional[str]
    ai_understanding_agreement: Optional[str]
    ai_understanding_rbi: Optional[str]
    rbi_clause: Optional[RBIClauseDetail]

    class Config:
        from_attributes = True


class SessionDetailResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    status: str
    documents: List[DocumentSummary]

    class Config:
        from_attributes = True


@router.post("/create", response_model=SessionResponse)
def create_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    session = AnalysisSession(title=request.title, status="pending")
    db.add(session)
    db.commit()
    db.refresh(session)
    doc_count = db.query(Document).filter(Document.session_id == session.id).count()
    logger.info("Created session %s with title '%s'", session.id, session.title)
    return SessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        status=session.status,
        document_count=doc_count
    )


@router.get("/", response_model=List[SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AnalysisSession).order_by(AnalysisSession.created_at.desc()).all()
    result = []
    for s in sessions:
        doc_count = db.query(Document).filter(Document.session_id == s.id).count()
        result.append(SessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            status=s.status,
            document_count=doc_count
        ))
    return result


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/{session_id}/documents/{document_id}/results", response_model=List[ComplianceResultDetail])
def get_document_results(session_id: int, document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.session_id == session_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    results = db.query(ComplianceResult).filter(
        ComplianceResult.document_id == document_id
    ).all()
    return results


@router.get("/{session_id}/rbi-clauses", response_model=List[RBIClauseDetail])
def get_rbi_clauses(session_id: int, db: Session = Depends(get_db)):
    clauses = db.query(RBIClause).all()
    return clauses


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    documents = db.query(Document).filter(Document.session_id == session_id).all()
    for doc in documents:
        file_path = os.path.join(UPLOAD_DIR, doc.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    db.delete(session)
    db.commit()
    logger.info("Deleted session %s", session_id)
    return {"message": "Session deleted successfully"}

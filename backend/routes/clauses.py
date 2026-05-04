from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import RBIClause, ComplianceResult

router = APIRouter(prefix="/api/clauses", tags=["clauses"])


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
    return clause


@router.delete("/{clause_id}", status_code=204)
def delete_clause(clause_id: int, db: Session = Depends(get_db)):
    clause = db.query(RBIClause).filter(RBIClause.id == clause_id).first()
    if not clause:
        raise HTTPException(status_code=404, detail="RBI clause not found")
    db.query(ComplianceResult).filter(ComplianceResult.rbi_clause_id == clause_id).delete()
    db.delete(clause)
    db.commit()

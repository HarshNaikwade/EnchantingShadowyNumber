from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class SessionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class DocumentType(str, enum.Enum):
    agreement = "Agreement"
    amendment = "Amendment"
    addendum = "Addendum"
    mou = "MOU"


class ComplianceStatus(str, enum.Enum):
    compliant = "Compliant"
    non_compliant = "Non-Compliant"
    review = "Review"


class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default=SessionStatus.pending)

    documents = relationship("Document", back_populates="session", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("analysis_sessions.id"), nullable=False)
    file_type = Column(String(50), nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    effective_date = Column(String(50), default="NA")
    creation_date = Column(String(50), default="NA")
    extracted_text = Column(Text, nullable=True)
    processing_status = Column(String(50), default="pending")

    session = relationship("AnalysisSession", back_populates="documents")
    compliance_results = relationship("ComplianceResult", back_populates="document", cascade="all, delete-orphan")


class RBIClause(Base):
    __tablename__ = "rbi_clauses"

    id = Column(Integer, primary_key=True, index=True)
    clause_text = Column(Text, nullable=False)
    predefined_meaning = Column(Text, nullable=True)
    category = Column(String(255), nullable=True)
    ai_understanding = Column(Text, nullable=True)

    compliance_results = relationship("ComplianceResult", back_populates="rbi_clause")


class ComplianceResult(Base):
    __tablename__ = "compliance_results"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    rbi_clause_id = Column(Integer, ForeignKey("rbi_clauses.id"), nullable=False)
    compliance_status = Column(String(50), default=ComplianceStatus.review)
    risk_score = Column(Float, default=50.0)
    agreement_reference = Column(String(500), nullable=True)
    ai_understanding_agreement = Column(Text, nullable=True)
    ai_understanding_rbi = Column(Text, nullable=True)

    document = relationship("Document", back_populates="compliance_results")
    rbi_clause = relationship("RBIClause", back_populates="compliance_results")

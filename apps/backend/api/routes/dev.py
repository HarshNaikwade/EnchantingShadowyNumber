# DEV ONLY — Gated behind ENABLE_DEV_ROUTES env var.
# Production deployments should NOT enable this.
import os
import hashlib
import difflib
import re
import logging

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Document, RBIClause
from core.config import UPLOAD_DIR

router = APIRouter(prefix="/api/dev", tags=["dev"])
logger = logging.getLogger(__name__)

# Gate dev routes behind environment variable
ENABLE_DEV_ROUTES = os.getenv("ENABLE_DEV_ROUTES", "false").lower() == "true"


def check_dev_enabled():
    """Dependency to check if dev routes are enabled."""
    if not ENABLE_DEV_ROUTES:
        raise HTTPException(
            status_code=403,
            detail="Dev routes are disabled. Set ENABLE_DEV_ROUTES=true to enable."
        )
    return True


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _diff_summary(raw: str, cleaned: str) -> str:
    raw_lines = raw.splitlines(keepends=True)
    clean_lines = cleaned.splitlines(keepends=True)
    diff = list(
        difflib.unified_diff(raw_lines, clean_lines, fromfile="raw", tofile="cleaned", n=2)
    )
    return "".join(diff[:1000])


def _detect_sections(text: str) -> list[dict]:
    sections = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            continue
        if re.match(r"^\d+(\.\d+)*[.\)]\s", s):
            sections.append({"type": "numbered", "heading": s[:200]})
        elif s.isupper() and 4 < len(s) < 120:
            sections.append({"type": "caps", "heading": s[:200]})
    return sections


def _extract_headings(text: str) -> list[str]:
    out = []
    for line in text.split("\n"):
        s = line.strip()
        if s and (s.isupper() or re.match(r"^\d+(\.\d+)*[.\)]", s)):
            out.append(s[:200])
    return out[:60]


def _extract_parties(text: str) -> list[str]:
    matches = re.findall(
        r"between\s+(.+?)\s+(?:and|&)\s+(.+?)(?:[.,\n]|$)",
        text[:5000],
        re.IGNORECASE,
    )
    seen = []
    for a, b in matches:
        for p in (a.strip(), b.strip()):
            if p and p not in seen:
                seen.append(p)
    return seen[:12]


@router.get("/document/{document_id}/parsed")
async def get_parsed_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(check_dev_enabled),
):
    """Return full parsing debug data for a document — DEV ONLY."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not on disk: {file_path}")

    ext = os.path.splitext(doc.filename)[1].lower()

    from services.parsing.parser import parse_pdf_with_pages, parse_docx_with_lines, clean_text

    if ext == ".pdf":
        raw_text, pages = parse_pdf_with_pages(file_path)
    else:
        raw_text, pages = parse_docx_with_lines(file_path)

    cleaned = clean_text(raw_text)
    raw_len = len(raw_text)
    clean_len = len(cleaned)
    missing_ratio = round((raw_len - clean_len) / raw_len, 4) if raw_len > 0 else 0.0

    extracted_clauses = [
        {
            "clause_id": r.rbi_clause_id,
            "compliance_status": r.compliance_status,
            "agreement_reference": r.agreement_reference,
            "ai_understanding_agreement": r.ai_understanding_agreement,
            "ai_understanding_rbi": r.ai_understanding_rbi,
        }
        for r in doc.compliance_results
    ]

    return {
        "document_id": doc.id,
        "file_name": doc.original_filename,
        "file_type": doc.file_type,
        "processing_status": doc.processing_status,
        "raw_text_full": raw_text,
        "raw_text_length": raw_len,
        "cleaned_text_full": cleaned,
        "cleaned_text_length": clean_len,
        "pages": pages,
        "detected_sections": _detect_sections(raw_text),
        "extracted_clauses": extracted_clauses,
        "metadata": {
            "dates": [doc.effective_date, doc.creation_date],
            "parties": _extract_parties(raw_text),
            "headings": _extract_headings(raw_text),
        },
        "validation": {
            "raw_vs_cleaned_diff": _diff_summary(raw_text, cleaned),
            "missing_ratio": missing_ratio,
            "raw_text_hash": _sha256(raw_text),
            "cleaned_text_hash": _sha256(cleaned),
        },
    }


@router.post("/rbi/analyze")
async def test_rbi_ai_analysis(
    db: Session = Depends(get_db),
    _: bool = Depends(check_dev_enabled),
):
    """Run AI understanding for every RBI clause — DEV ONLY."""
    from services.ai.analyzer import generate_rbi_understanding, get_active_provider, check_ai_connection

    connected = await check_ai_connection()
    if not connected:
        provider = get_active_provider()
        raise HTTPException(status_code=503, detail=f"{provider.upper()} is not reachable")

    clauses = db.query(RBIClause).all()
    results = []

    for clause in clauses:
        try:
            understanding = await generate_rbi_understanding(clause.clause_text)
            clause.ai_understanding = understanding
            db.commit()
            results.append({
                "clause_id": clause.id,
                "text": clause.clause_text,
                "ai_understanding": understanding,
            })
        except Exception as exc:
            logger.error("DEV RBI analyze — clause %d failed: %s", clause.id, exc)
            db.rollback()
            results.append({
                "clause_id": clause.id,
                "text": clause.clause_text,
                "ai_understanding": f"ERROR: {exc}",
            })

    return results

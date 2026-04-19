import io
import os
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models import AnalysisSession, Document, ComplianceResult, RBIClause

router = APIRouter(prefix="/api/report", tags=["reports"])
logger = logging.getLogger(__name__)


def generate_pdf_report(session: AnalysisSession, documents: list, db: Session) -> bytes:
    """Generate a PDF compliance report using reportlab."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch, mm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, PageBreak, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'Title', parent=styles['Title'],
            fontSize=16, spaceAfter=6, textColor=colors.HexColor('#1e3a5f')
        )
        heading_style = ParagraphStyle(
            'Heading', parent=styles['Heading2'],
            fontSize=12, spaceAfter=4, textColor=colors.HexColor('#2563eb')
        )
        normal_style = ParagraphStyle(
            'Normal', parent=styles['Normal'],
            fontSize=7, leading=9, wordWrap='CJK'
        )
        small_style = ParagraphStyle(
            'Small', parent=styles['Normal'],
            fontSize=6, leading=8, wordWrap='CJK'
        )

        elements = []

        elements.append(Paragraph(f"RBI Compliance Analysis Report", title_style))
        elements.append(Paragraph(f"Analysis Session: {session.title}", heading_style))
        elements.append(Paragraph(
            f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')} | Status: {session.status.upper()}",
            normal_style
        ))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2563eb')))
        elements.append(Spacer(1, 8*mm))

        rbi_clauses = db.query(RBIClause).all()

        for doc_obj in documents:
            elements.append(Paragraph(
                f"Document: {doc_obj.original_filename} ({doc_obj.file_type})",
                heading_style
            ))
            elements.append(Paragraph(
                f"Effective Date: {doc_obj.effective_date} | Creation Date: {doc_obj.creation_date}",
                normal_style
            ))
            elements.append(Spacer(1, 4*mm))

            elements.append(Paragraph("Table 1: RBI Clauses", styles['Heading3']))
            rbi_data = [["#", "RBI Clause", "Predefined Meaning", "AI Understanding"]]
            for i, clause in enumerate(rbi_clauses, 1):
                rbi_data.append([
                    str(i),
                    Paragraph(clause.clause_text[:200] + "..." if len(clause.clause_text) > 200 else clause.clause_text, small_style),
                    Paragraph(clause.predefined_meaning[:150] + "..." if clause.predefined_meaning and len(clause.predefined_meaning) > 150 else (clause.predefined_meaning or ""), small_style),
                    Paragraph(clause.ai_understanding[:150] + "..." if clause.ai_understanding and len(clause.ai_understanding) > 150 else (clause.ai_understanding or ""), small_style),
                ])
            t1 = Table(rbi_data, colWidths=[0.3*inch, 2.5*inch, 2.5*inch, 2.5*inch])
            t1.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4f8')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t1)
            elements.append(Spacer(1, 6*mm))

            results = db.query(ComplianceResult).filter(
                ComplianceResult.document_id == doc_obj.id
            ).all()

            elements.append(Paragraph("Table 2: Agreement Clauses & AI Understanding", styles['Heading3']))
            ag_data = [["#", "RBI Clause Reference", "AI Understanding of Agreement"]]
            for i, result in enumerate(results, 1):
                ag_data.append([
                    str(i),
                    Paragraph(f"RBI Clause #{result.rbi_clause_id}", small_style),
                    Paragraph(result.ai_understanding_agreement[:200] + "..." if result.ai_understanding_agreement and len(result.ai_understanding_agreement) > 200 else (result.ai_understanding_agreement or "Not analyzed"), small_style),
                ])
            t2 = Table(ag_data, colWidths=[0.3*inch, 1.5*inch, 6*inch])
            t2.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4f8')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t2)
            elements.append(Spacer(1, 6*mm))

            elements.append(Paragraph("Table 3: Compliance Report", styles['Heading3']))
            comp_data = [["#", "RBI Clause Ref", "Compliance Status", "Risk Score", "Agreement Reference"]]
            for i, result in enumerate(results, 1):
                status_color = {
                    "Compliant": colors.HexColor('#16a34a'),
                    "Non-Compliant": colors.HexColor('#dc2626'),
                    "Review": colors.HexColor('#d97706'),
                }.get(result.compliance_status, colors.black)

                comp_data.append([
                    str(i),
                    Paragraph(f"RBI #{result.rbi_clause_id}", small_style),
                    Paragraph(result.compliance_status, ParagraphStyle('Status', parent=small_style, textColor=status_color, fontName='Helvetica-Bold')),
                    Paragraph(f"{result.risk_score:.0f}/100", small_style),
                    Paragraph(result.agreement_reference or "N/A", small_style),
                ])
            t3 = Table(comp_data, colWidths=[0.3*inch, 1.2*inch, 1.3*inch, 0.8*inch, 4.2*inch])
            t3.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4f8')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t3)
            elements.append(PageBreak())

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed")


@router.get("/{session_id}")
def generate_report(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    documents = db.query(Document).filter(Document.session_id == session_id).all()

    pdf_bytes = generate_pdf_report(session, documents, db)

    safe_title = "".join(c for c in session.title if c.isalnum() or c in " _-").rstrip()
    filename = f"compliance_report_{safe_title}_{session_id}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{session_id}/document/{document_id}")
def generate_document_report(session_id: int, document_id: int, db: Session = Depends(get_db)):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    documents = db.query(Document).filter(
        Document.session_id == session_id,
        Document.id == document_id
    ).all()
    if not documents:
        raise HTTPException(status_code=404, detail="Document not found")

    pdf_bytes = generate_pdf_report(session, documents, db)

    doc_obj = documents[0]
    safe_name = "".join(c for c in doc_obj.original_filename if c.isalnum() or c in " _-.").rstrip()
    filename = f"compliance_{safe_name}_{document_id}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

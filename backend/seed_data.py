"""Seed script to populate dummy RBI Clauses for testing."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, Base
from models import RBIClause

SEED_RBI_CLAUSES = [
    {
        "clause_text": "All lending agreements must clearly state the Annual Percentage Rate (APR) including all fees, charges, and interest rates in a standardized format as per RBI Master Direction on Interest Rate on Advances.",
        "predefined_meaning": "Lenders must disclose the total cost of credit including all fees and interest in a transparent, standardized manner.",
        "category": "Transparency & Disclosure",
    },
    {
        "clause_text": "Banks and financial institutions shall not levy any prepayment penalty or foreclosure charges on floating rate term loans sanctioned to individual borrowers for purposes other than business.",
        "predefined_meaning": "Borrowers cannot be charged fees for paying off floating-rate personal loans early.",
        "category": "Consumer Protection",
    },
    {
        "clause_text": "Any grievance redressal mechanism must be clearly defined in the agreement, including escalation timelines, designated Grievance Redressal Officer contact details, and RBI Banking Ombudsman information as per RBI Circular on Customer Service.",
        "predefined_meaning": "Agreements must include a clear process for customers to raise and resolve complaints, with specific timelines and contact information.",
        "category": "Grievance Redressal",
    },
    {
        "clause_text": "All agreements involving data sharing, storage, or processing of customer financial data must comply with RBI Guidelines on Digital Lending. Customer data shall not be sold or shared with third parties without explicit written consent, except as required by law.",
        "predefined_meaning": "Customer financial data must be protected and cannot be shared without explicit consent.",
        "category": "Data Privacy & Security",
    },
    {
        "clause_text": "Recovery proceedings against defaulting borrowers must comply with the Code of Conduct for Recovery Agents. Intimidation, harassment, or contact outside 7 AM to 7 PM local time is strictly prohibited. All recovery communications must be documented.",
        "predefined_meaning": "Debt recovery must follow ethical guidelines with restrictions on timing, communication methods, and prohibited harassment.",
        "category": "Fair Practices & Recovery",
    },
    {
        "clause_text": "All agreements must include a Key Facts Statement (KFS) as per RBI directions, clearly stating: loan amount, tenure, interest rate (fixed/floating), EMI amount, total repayable amount, applicable charges, and cooling-off/look-up period.",
        "predefined_meaning": "A standardized summary sheet (KFS) must be provided with all key loan terms before agreement signing.",
        "category": "Key Facts Statement",
    },
    {
        "clause_text": "Foreign currency transactions and cross-border agreements must comply with the Foreign Exchange Management Act (FEMA) and RBI Master Direction on Foreign Exchange Derivative Contracts. All remittances must be routed through authorized dealer banks.",
        "predefined_meaning": "International financial transactions must follow FEMA regulations and use authorized banking channels.",
        "category": "Foreign Exchange Compliance",
    },
]


def seed_database():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(RBIClause).count()
        if existing > 0:
            print(f"Database already has {existing} RBI clauses. Skipping seed.")
            return

        print(f"Seeding {len(SEED_RBI_CLAUSES)} RBI clauses...")
        for clause_data in SEED_RBI_CLAUSES:
            clause = RBIClause(**clause_data)
            db.add(clause)

        db.commit()
        print(f"Successfully seeded {len(SEED_RBI_CLAUSES)} RBI clauses.")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

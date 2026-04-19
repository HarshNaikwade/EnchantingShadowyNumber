import json
import logging
import re
import httpx
import os
from typing import Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")


async def check_ollama_connection() -> bool:
    """Check if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


async def ollama_generate(prompt: str, model: str = None) -> str:
    """Send a prompt to Ollama and return the response."""
    model = model or OLLAMA_MODEL
    async with httpx.AsyncClient(timeout=120.0) as client:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2048,
            }
        }
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")


def extract_json_from_response(text: str) -> Optional[dict]:
    """Extract JSON from Ollama response, handling markdown code blocks."""
    text = text.strip()
    patterns = [
        r'```json\s*([\s\S]+?)\s*```',
        r'```\s*([\s\S]+?)\s*```',
        r'(\{[\s\S]+\})',
        r'(\[[\s\S]+\])',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def extract_agreement_clauses(text: str) -> list:
    """Step 1: Extract all distinct clauses from the agreement text."""
    prompt = f"""You are a legal document analyzer. Extract all distinct clauses from the following agreement text.

For each clause, provide a JSON response with this exact structure:
{{
  "clauses": [
    {{
      "clause_id": "1.1",
      "text": "The actual clause text",
      "simplified_meaning": "A plain English explanation of what this clause means",
      "reference": "Page X, Clause Y or Approximate Reference"
    }}
  ]
}}

If the agreement contains a general statement like "We follow all RBI guidelines", classify it as:
- simplified_meaning: "General Compliance Statement - requires specific clause mapping for detailed verification"

Agreement Text:
{text[:8000]}

Respond ONLY with valid JSON. No explanations outside the JSON structure."""

    response = await ollama_generate(prompt)
    data = extract_json_from_response(response)
    if data and isinstance(data, dict):
        return data.get("clauses", [])
    elif data and isinstance(data, list):
        return data
    return []


async def generate_rbi_understanding(clause_text: str, predefined_meaning: str) -> str:
    """Step 2: Generate AI understanding of an RBI clause."""
    prompt = f"""You are an RBI (Reserve Bank of India) compliance expert.

Analyze this RBI regulatory clause and provide a detailed AI understanding:

RBI Clause: {clause_text}
Predefined Meaning: {predefined_meaning}

Respond with a JSON object:
{{
  "ai_understanding": "A comprehensive explanation of what this RBI clause requires, its regulatory intent, and key compliance points that agreements must address."
}}

Respond ONLY with valid JSON."""

    response = await ollama_generate(prompt)
    data = extract_json_from_response(response)
    if data and isinstance(data, dict):
        return data.get("ai_understanding", predefined_meaning)
    return predefined_meaning


async def check_compliance(
    agreement_clauses: list,
    rbi_clause_text: str,
    rbi_clause_id: int,
    document_type: str = "Agreement"
) -> dict:
    """Step 3: Check compliance of agreement clauses against an RBI clause."""

    clauses_text = json.dumps(agreement_clauses[:10], indent=2)

    incremental_instruction = ""
    if document_type == "Amendment":
        incremental_instruction = "Note: This is an Amendment. Focus on new/changed clauses and mark others as 'Previously Covered'."
    elif document_type == "Addendum":
        incremental_instruction = "Note: This is an Addendum. Identify new clauses as 'New Clause' and mark existing ones as 'Previously Covered'."
    elif document_type == "MOU":
        incremental_instruction = "Note: This is an MOU. Check if it supersedes the main agreement and flag any conflicts with RBI requirements."

    prompt = f"""You are an RBI compliance checker. Compare the agreement clauses against the RBI requirement.

{incremental_instruction}

RBI Requirement (Clause ID: {rbi_clause_id}):
{rbi_clause_text}

Agreement Clauses (excerpt):
{clauses_text}

Determine compliance and respond with this exact JSON structure:
{{
  "compliance_status": "Compliant" | "Non-Compliant" | "Review",
  "risk_score": <number 0-100, where 0=fully compliant, 100=fully non-compliant>,
  "agreement_reference": "Clause X.X, Page Y (or 'Approximate Reference: ...' or 'Not Found')",
  "ai_understanding_agreement": "How the agreement addresses (or fails to address) this RBI requirement",
  "ai_understanding_rbi": "What this RBI clause specifically requires",
  "notes": "Any additional compliance observations"
}}

Rules:
- If the agreement has a general statement like 'We follow all RBI guidelines', mark as 'Review' with risk_score 60 and note that specific clause mapping is required.
- If completely compliant: risk_score 0-30, status 'Compliant'
- If partially compliant or unclear: risk_score 31-60, status 'Review'
- If non-compliant: risk_score 61-100, status 'Non-Compliant'

Respond ONLY with valid JSON."""

    response = await ollama_generate(prompt)
    data = extract_json_from_response(response)

    if data and isinstance(data, dict):
        return {
            "compliance_status": data.get("compliance_status", "Review"),
            "risk_score": float(data.get("risk_score", 50)),
            "agreement_reference": data.get("agreement_reference", "Approximate Reference: Not explicitly found"),
            "ai_understanding_agreement": data.get("ai_understanding_agreement", ""),
            "ai_understanding_rbi": data.get("ai_understanding_rbi", ""),
        }

    return {
        "compliance_status": "Review",
        "risk_score": 50.0,
        "agreement_reference": "Approximate Reference: Analysis could not be completed",
        "ai_understanding_agreement": "Unable to analyze - please review manually",
        "ai_understanding_rbi": rbi_clause_text,
    }

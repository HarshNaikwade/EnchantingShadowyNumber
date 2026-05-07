"""
AI provider abstraction layer.
Supports Ollama (local), LMStudio (local), and Groq (cloud) via the AI_PROVIDER env var.

Quick-start:
  Ollama (default):
    AI_PROVIDER=ollama
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_MODEL=gemma4:latest

  LMStudio (local, OpenAI-compatible):
    AI_PROVIDER=lmstudio
    LMSTUDIO_BASE_URL=http://localhost:1234
    LMSTUDIO_MODEL=gemma4

  Groq (cloud):
    AI_PROVIDER=groq
    GROQ_API_KEY=gsk_...
    GROQ_MODEL=llama-3.3-70b-versatile
"""
import asyncio
import json
import logging
import re
import httpx
import os
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "ollama").lower()

# Ollama
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:latest")


def get_ollama_base_url() -> str:
    """Return the active Ollama base URL (runtime-configurable)."""
    try:
        from core.runtime_config import get_setting
        return get_setting("ollama_url", OLLAMA_BASE_URL)
    except Exception:
        return OLLAMA_BASE_URL

# LMStudio (local, OpenAI-compatible)
LMSTUDIO_BASE_URL: str = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234")
LMSTUDIO_MODEL: str = os.getenv("LMSTUDIO_MODEL", "gemma4")


def get_lmstudio_base_url() -> str:
    """Return the active LMStudio base URL (runtime-configurable)."""
    try:
        from core.runtime_config import get_setting
        return get_setting("lmstudio_url", LMSTUDIO_BASE_URL)
    except Exception:
        return LMSTUDIO_BASE_URL

# Groq  (OpenAI-compatible)
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"


# ---------------------------------------------------------------------------
# Provider helpers  (read runtime_config so the dropdown switch takes effect)
# ---------------------------------------------------------------------------
def get_active_provider() -> str:
    try:
        from core.runtime_config import get_setting
        return get_setting("ai_provider", AI_PROVIDER)
    except Exception:
        return AI_PROVIDER


def get_ai_model() -> str:
    provider = get_active_provider()
    if provider == "groq":
        return GROQ_MODEL
    elif provider == "lmstudio":
        return LMSTUDIO_MODEL
    else:
        return OLLAMA_MODEL


# ---------------------------------------------------------------------------
# Connection checks
# ---------------------------------------------------------------------------
async def check_ollama_connection() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{get_ollama_base_url()}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def check_lmstudio_connection() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{get_lmstudio_base_url()}/v1/models")
            return r.status_code == 200
    except Exception:
        return False


async def check_groq_connection() -> bool:
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set.")
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{GROQ_BASE_URL}/models",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            )
            return r.status_code == 200
    except Exception:
        return False


async def check_ai_connection() -> bool:
    """Check whether the active AI provider is reachable."""
    provider = get_active_provider()
    if provider == "groq":
        return await check_groq_connection()
    elif provider == "lmstudio":
        return await check_lmstudio_connection()
    return await check_ollama_connection()


# ---------------------------------------------------------------------------
# Ollama: list / resolve models
# ---------------------------------------------------------------------------
async def list_ollama_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{get_ollama_base_url()}/api/tags")
            r.raise_for_status()
            return [m.get("name") for m in r.json().get("models", []) if m.get("name")]
    except Exception:
        return []


async def resolve_ollama_model(requested: Optional[str] = None) -> Optional[str]:
    models = await list_ollama_models()
    if not models:
        return None
    if requested and requested in models:
        return requested
    if requested:
        logger.warning("Ollama model '%s' not found; falling back to '%s'.", requested, models[0])
    return models[0]


# ---------------------------------------------------------------------------
# LMStudio: list / resolve models (OpenAI-compatible)
# ---------------------------------------------------------------------------
async def list_lmstudio_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{get_lmstudio_base_url()}/v1/models")
            r.raise_for_status()
            data = r.json()
            return [m.get("id") for m in data.get("data", []) if m.get("id")]
    except Exception as e:
        logger.warning("Failed to list LMStudio models: %s", e)
        return []


async def resolve_lmstudio_model(requested: Optional[str] = None) -> Optional[str]:
    models = await list_lmstudio_models()
    if not models:
        return None
    if requested and requested in models:
        return requested
    if requested:
        logger.warning("LMStudio model '%s' not found; falling back to '%s'.", requested, models[0])
    return models[0]


# ---------------------------------------------------------------------------
# Ollama generate  (non-streaming by default; streaming only when on_chunk given)
# ---------------------------------------------------------------------------
async def ollama_generate(
    prompt: str,
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> str:
    if model is None:
        model = await resolve_ollama_model(OLLAMA_MODEL)
    if not model:
        logger.warning("No Ollama models available.")
        return ""

    use_stream = bool(on_chunk)
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": use_stream,
        "options": {"temperature": 0.1, "num_predict": 2048},
    }

    logger.debug("Ollama request → model=%s stream=%s prompt_len=%d", model, use_stream, len(prompt))

    base_url = get_ollama_base_url()
    async with httpx.AsyncClient(timeout=120.0) as client:
        if not use_stream:
            # ── Non-streaming (most reliable) ──────────────────────────────
            response = await client.post(f"{base_url}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            raw = data.get("response", "")
            logger.debug("Ollama raw response (%d chars): %s", len(raw), raw[:300])
            if not raw:
                logger.warning("Ollama returned an empty 'response' field. Full payload: %s", json.dumps(data)[:500])
            return raw

        # ── Streaming ──────────────────────────────────────────────────────
        output_parts: list[str] = []
        async with client.stream("POST", f"{base_url}/api/generate", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    logger.debug("Ollama stream: skipping non-JSON line: %s", line[:100])
                    continue
                chunk = data.get("response", "")
                if chunk:
                    on_chunk(chunk)
                    output_parts.append(chunk)
                if data.get("done"):
                    break

        output = "".join(output_parts)
        logger.debug("Ollama stream complete (%d chars): %s", len(output), output[:300])
        if not output:
            logger.warning("Ollama streaming produced no output for model=%s", model)
        return output


# ---------------------------------------------------------------------------
# LMStudio generate (OpenAI-compatible chat completions)
# ---------------------------------------------------------------------------
async def lmstudio_generate(
    prompt: str,
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> str:
    if model is None:
        model = await resolve_lmstudio_model(LMSTUDIO_MODEL)
    if not model:
        logger.warning("No LMStudio models available.")
        return ""

    headers = {"Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2048,
        "stream": False,
    }

    logger.debug("LMStudio request → model=%s prompt_len=%d", model, len(prompt))

    base_url = get_lmstudio_base_url()
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected LMStudio response structure (%s). Full response: %s", exc, json.dumps(data)[:500])
        return ""

    logger.debug("LMStudio raw response (%d chars): %s", len(raw), raw[:300])
    if not raw:
        logger.warning("LMStudio returned empty content. Full response: %s", json.dumps(data)[:500])

    # If caller wants streaming-style chunks, simulate by calling on_chunk once
    if on_chunk and raw:
        on_chunk(raw)

    return raw


# ---------------------------------------------------------------------------
# Groq generate  (OpenAI-compatible chat completions, always non-streaming)
# ---------------------------------------------------------------------------
async def groq_generate(
    prompt: str,
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> str:
    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set. Cannot call Groq.")
        return ""

    model = model or GROQ_MODEL
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2048,
        "stream": False,
    }

    logger.debug("Groq request → model=%s prompt_len=%d", model, len(prompt))

    max_retries = 4
    for attempt in range(max_retries + 1):
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

        if response.status_code == 429:
            if attempt < max_retries:
                wait = int(response.headers.get("retry-after", "")) if response.headers.get("retry-after", "").isdigit() else min(10 * (2 ** attempt), 60)
                logger.warning(
                    "Groq rate limited (429). Waiting %ds before retry %d/%d.",
                    wait, attempt + 1, max_retries,
                )
                await asyncio.sleep(wait)
                continue
            response.raise_for_status()

        response.raise_for_status()
        data = response.json()
        break

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Groq response structure (%s). Full response: %s", exc, json.dumps(data)[:500])
        return ""

    logger.debug("Groq raw response (%d chars): %s", len(raw), raw[:300])
    if not raw:
        logger.warning("Groq returned empty content. Full response: %s", json.dumps(data)[:500])

    # If caller wants streaming-style chunks, simulate by calling on_chunk once
    if on_chunk and raw:
        on_chunk(raw)

    return raw


# ---------------------------------------------------------------------------
# Unified entry point — routes to the active provider
# ---------------------------------------------------------------------------
async def ai_generate(
    prompt: str,
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> str:
    """Call the active AI provider (ollama, lmstudio, or groq) and return the text output."""
    provider = get_active_provider()
    if provider == "groq":
        return await groq_generate(prompt, model=model, on_chunk=on_chunk)
    elif provider == "lmstudio":
        return await lmstudio_generate(prompt, model=model, on_chunk=on_chunk)
    return await ollama_generate(prompt, model=model, on_chunk=on_chunk)


# ---------------------------------------------------------------------------
# JSON extraction from model output
# ---------------------------------------------------------------------------
def extract_json_from_response(text: str) -> Optional[dict | list]:
    """Extract JSON from a model response, tolerating markdown code fences."""
    if not text:
        logger.warning("extract_json_from_response: received empty text.")
        return None

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
            candidate = match.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    # Last resort: try the whole text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(
            "extract_json_from_response: could not parse JSON from response. "
            "First 400 chars: %s",
            text[:400],
        )
        return None


# ---------------------------------------------------------------------------
# High-level analysis functions
# ---------------------------------------------------------------------------
async def extract_agreement_clauses(
    text: str,
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> list:
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

    response = await ai_generate(prompt, model=model, on_chunk=on_chunk)
    if not response:
        logger.warning("extract_agreement_clauses: AI returned no output.")
        return []

    data = extract_json_from_response(response)
    if data and isinstance(data, dict):
        clauses = data.get("clauses", [])
        logger.info("extract_agreement_clauses: extracted %d clauses.", len(clauses))
        return clauses
    elif data and isinstance(data, list):
        logger.info("extract_agreement_clauses: extracted %d clauses (list form).", len(data))
        return data

    logger.warning("extract_agreement_clauses: JSON parse failed; returning empty list.")
    return []


async def generate_rbi_understanding(
    clause_text: str,
    predefined_meaning: Optional[str],
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> str:
    predefined = predefined_meaning or "No predefined meaning was provided."
    prompt = f"""You are an RBI (Reserve Bank of India) compliance expert.

Analyze this RBI regulatory clause and provide a detailed AI understanding:

RBI Clause: {clause_text}
Predefined Meaning: {predefined}

Respond with a JSON object:
{{
  "ai_understanding": "A comprehensive explanation of what this RBI clause requires, its regulatory intent, and key compliance points that agreements must address."
}}

Respond ONLY with valid JSON."""

    response = await ai_generate(prompt, model=model, on_chunk=on_chunk)
    if not response:
        logger.warning("generate_rbi_understanding: AI returned no output; using predefined meaning.")
        return predefined

    data = extract_json_from_response(response)
    if data and isinstance(data, dict):
        understanding = data.get("ai_understanding", "")
        if understanding:
            return understanding
        logger.warning("generate_rbi_understanding: 'ai_understanding' key missing or empty in parsed JSON.")

    logger.warning("generate_rbi_understanding: falling back to predefined meaning.")
    return predefined


async def check_compliance(
    agreement_clauses: list,
    rbi_clause_text: str,
    rbi_clause_id: int,
    document_type: str = "Agreement",
    model: Optional[str] = None,
    on_chunk: Optional[Callable[[str], None]] = None,
) -> dict:
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

    _fallback = {
        "compliance_status": "Review",
        "risk_score": 50.0,
        "agreement_reference": "Approximate Reference: Analysis could not be completed",
        "ai_understanding_agreement": "Unable to analyze — please review manually",
        "ai_understanding_rbi": rbi_clause_text,
    }

    response = await ai_generate(prompt, model=model, on_chunk=on_chunk)
    if not response:
        logger.warning("check_compliance (clause %d): AI returned no output.", rbi_clause_id)
        return _fallback

    data = extract_json_from_response(response)
    if data and isinstance(data, dict):
        return {
            "compliance_status": data.get("compliance_status", "Review"),
            "risk_score": float(data.get("risk_score", 50)),
            "agreement_reference": data.get("agreement_reference", "Approximate Reference: Not explicitly found"),
            "ai_understanding_agreement": data.get("ai_understanding_agreement", ""),
            "ai_understanding_rbi": data.get("ai_understanding_rbi", ""),
        }

    logger.warning("check_compliance (clause %d): JSON parse failed; returning fallback.", rbi_clause_id)
    return _fallback

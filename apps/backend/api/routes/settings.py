import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.config import AI_PROVIDER as DEFAULT_AI_PROVIDER
from core.config import LMSTUDIO_BASE_URL, OLLAMA_BASE_URL
from core.runtime_config import get_setting, set_setting

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)

_ALLOWED_PROVIDERS = {"ollama", "lmstudio", "groq"}


class ProviderUpdate(BaseModel):
    provider: str


class UrlUpdate(BaseModel):
    url: str


def _normalize_url(url: str, *, strip_openai_v1: bool = False) -> str:
    normalized = url.strip().rstrip("/")
    if strip_openai_v1 and normalized.endswith("/v1"):
        return normalized[:-3]
    return normalized


@router.get("/provider")
def get_provider():
    return {"provider": get_setting("ai_provider", DEFAULT_AI_PROVIDER)}


@router.post("/provider")
def update_provider(payload: ProviderUpdate):
    provider = payload.provider.strip().lower()
    if provider not in _ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported AI provider")

    set_setting("ai_provider", provider)
    logger.info("AI provider updated to %s", provider)
    return {"provider": provider}


@router.get("/ollama-url")
def get_ollama_url():
    return {"url": get_setting("ollama_url", OLLAMA_BASE_URL)}


@router.post("/ollama-url")
def update_ollama_url(payload: UrlUpdate):
    url = _normalize_url(payload.url)
    if not url:
        raise HTTPException(status_code=400, detail="Ollama URL cannot be empty")

    set_setting("ollama_url", url)
    logger.info("Ollama URL updated to %s", url)
    return {"url": url}


@router.get("/lmstudio-url")
def get_lmstudio_url():
    return {"url": get_setting("lmstudio_url", LMSTUDIO_BASE_URL)}


@router.post("/lmstudio-url")
def update_lmstudio_url(payload: UrlUpdate):
    url = _normalize_url(payload.url, strip_openai_v1=True)
    if not url:
        raise HTTPException(status_code=400, detail="LMStudio URL cannot be empty")

    set_setting("lmstudio_url", url)
    logger.info("LMStudio URL updated to %s", url)
    return {"url": url}

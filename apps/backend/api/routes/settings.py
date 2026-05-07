from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.runtime_config import get_setting, set_setting

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_PROVIDERS = {"ollama", "groq"}


class ProviderUpdate(BaseModel):
    provider: str


class OllamaUrlUpdate(BaseModel):
    url: str


@router.get("/provider")
def get_provider():
    return {"provider": get_setting("ai_provider")}


@router.post("/provider")
def update_provider(body: ProviderUpdate):
    if body.provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{body.provider}'. Must be one of: {sorted(VALID_PROVIDERS)}",
        )
    set_setting("ai_provider", body.provider)
    return {"provider": body.provider}


@router.get("/ollama-url")
def get_ollama_url():
    return {"url": get_setting("ollama_url")}


@router.post("/ollama-url")
def update_ollama_url(body: OllamaUrlUpdate):
    url = body.url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    set_setting("ollama_url", url)
    return {"url": url}

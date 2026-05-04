from fastapi import APIRouter
from log_buffer import get_logs

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/logs")
def list_logs(limit: int = 200):
    return {"logs": get_logs(limit)}

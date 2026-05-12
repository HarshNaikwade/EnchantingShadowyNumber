from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from queue import Queue, Empty
from typing import Optional

STALE_SECONDS = 30
MAX_RESPONSE_CHARS = 4000


@dataclass
class ProgressState:
    document_id: int
    status: str = "starting"
    step: str = "starting"
    message: str = ""
    response_preview: str = ""
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    last_chunk_at: Optional[str] = None
    error: Optional[str] = None
    done: bool = False


_lock = Lock()
_progress: dict[int, ProgressState] = {}
_events: dict[int, Queue[dict]] = {}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _snapshot(state: ProgressState) -> dict:
    last_chunk_age = None
    stalled = False
    now = datetime.utcnow()
    if state.last_chunk_at:
        last = datetime.fromisoformat(state.last_chunk_at.replace("Z", "+00:00"))
        now = now.replace(tzinfo=last.tzinfo)
        last_chunk_age = int((now - last).total_seconds())
        stalled = not state.done and last_chunk_age > STALE_SECONDS
    else:
        updated = datetime.fromisoformat(state.updated_at.replace("Z", "+00:00"))
        now = now.replace(tzinfo=updated.tzinfo)
        last_chunk_age = int((now - updated).total_seconds())
        stalled = not state.done and last_chunk_age > STALE_SECONDS

    return {
        "document_id": state.document_id,
        "status": state.status,
        "step": state.step,
        "message": state.message,
        "response_preview": state.response_preview,
        "started_at": state.started_at,
        "updated_at": state.updated_at,
        "last_chunk_at": state.last_chunk_at,
        "last_chunk_age": last_chunk_age,
        "stalled": stalled,
        "error": state.error,
        "done": state.done,
    }


def _queue_for(document_id: int) -> Queue[dict]:
    queue = _events.get(document_id)
    if queue is None:
        queue = Queue()
        _events[document_id] = queue
    return queue


def _emit(document_id: int) -> None:
    state = _progress.get(document_id)
    if not state:
        return
    try:
        _queue_for(document_id).put_nowait(_snapshot(state))
    except Exception:
        pass


def start(document_id: int, step: str, message: str = "") -> None:
    with _lock:
        _progress[document_id] = ProgressState(
            document_id=document_id,
            status="processing",
            step=step,
            message=message,
        )
        _queue_for(document_id)
        _emit(document_id)


def update(
    document_id: int,
    step: Optional[str] = None,
    message: Optional[str] = None,
    status: Optional[str] = None,
) -> None:
    with _lock:
        state = _progress.get(document_id)
        if not state:
            return
        if step is not None:
            state.step = step
        if message is not None:
            state.message = message
        if status is not None:
            state.status = status
        state.updated_at = _now()
        _emit(document_id)


def append_chunk(document_id: int, chunk: str) -> None:
    if not chunk:
        return
    with _lock:
        state = _progress.get(document_id)
        if not state:
            return
        state.response_preview = (state.response_preview + chunk)[-MAX_RESPONSE_CHARS:]
        state.last_chunk_at = _now()
        state.updated_at = _now()
        _emit(document_id)


def set_error(document_id: int, error: str, status: str = "failed") -> None:
    with _lock:
        state = _progress.get(document_id)
        if not state:
            return
        state.error = error
        state.status = status
        state.done = True
        state.updated_at = _now()
        _emit(document_id)


def complete(document_id: int, status: str = "completed") -> None:
    with _lock:
        state = _progress.get(document_id)
        if not state:
            return
        state.status = status
        state.done = True
        state.updated_at = _now()
        _emit(document_id)


def get(document_id: int) -> Optional[dict]:
    with _lock:
        state = _progress.get(document_id)
        if not state:
            return None
        return _snapshot(state)


def get_next_event(document_id: int, timeout: float = 15.0) -> Optional[dict]:
    try:
        return _queue_for(document_id).get(timeout=timeout)
    except Empty:
        return None

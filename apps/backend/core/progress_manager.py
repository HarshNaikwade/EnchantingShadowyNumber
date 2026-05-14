"""
Unified progress tracking system for document and clause analysis.
Consolidates functionality from previous progress tracking modules.
"""
import json
import queue as queue_module
import threading
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

# Thread-safe event queue
_event_queue: queue_module.Queue = queue_module.Queue(maxsize=1000)

# For document progress tracking (legacy)
_lock = threading.Lock()
_document_progress: dict = {}


@dataclass
class AnalysisEvent:
    """Event sent to clients during analysis."""
    type: str  # "started", "clause_progress", "clause_completed", "completed", "error", "doc_update"
    clause_id: Optional[int] = None
    clause_number: Optional[int] = None
    total_clauses: Optional[int] = None
    document_id: Optional[int] = None
    message: Optional[str] = None
    understanding: Optional[str] = None


def get_event_json(event: AnalysisEvent) -> str:
    """Convert event to JSON string."""
    return json.dumps(asdict(event))


# ─────────────────────────────────────────────────────────────────────────
# Clause Analysis Events (Simple, queue-based)
# ─────────────────────────────────────────────────────────────────────────

def emit_event(event: AnalysisEvent) -> None:
    """Emit an event to the queue (thread-safe)."""
    try:
        _event_queue.put_nowait(event)
    except queue_module.Full:
        pass  # Drop if queue is full


def emit_started(total_clauses: int) -> None:
    """Emit analysis started event."""
    emit_event(AnalysisEvent(
        type="started",
        total_clauses=total_clauses,
        message="Analysis started"
    ))


def emit_clause_progress(clause_id: int, clause_number: int, total_clauses: int, message: str) -> None:
    """Emit clause analysis progress event."""
    emit_event(AnalysisEvent(
        type="clause_progress",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        message=message
    ))


def emit_clause_completed(clause_id: int, clause_number: int, total_clauses: int, understanding: str) -> None:
    """Emit clause completed event."""
    emit_event(AnalysisEvent(
        type="clause_completed",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        understanding=understanding,
        message="Clause analysis completed"
    ))


def emit_completed() -> None:
    """Emit analysis completed event."""
    emit_event(AnalysisEvent(
        type="completed",
        message="Analysis completed"
    ))


def emit_error(message: str) -> None:
    """Emit analysis error event."""
    emit_event(AnalysisEvent(
        type="error",
        message=message
    ))


def get_next_event(timeout: float = 55.0) -> Optional[AnalysisEvent]:
    """Get next event, blocking up to timeout seconds."""
    try:
        event = _event_queue.get(timeout=timeout)
        return event
    except queue_module.Empty:
        return None


# ─────────────────────────────────────────────────────────────────────────
# Document Progress Tracking (Legacy, for document analysis streams)
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class DocumentProgressState:
    """State for tracking document analysis progress."""
    document_id: int
    status: str = "starting"
    step: str = "starting"
    message: str = ""
    response_preview: str = ""
    started_at: str = ""
    updated_at: str = ""
    last_chunk_at: Optional[str] = None
    error: Optional[str] = None
    done: bool = False

    def __post_init__(self):
        if not self.started_at:
            self.started_at = datetime.utcnow().isoformat() + "Z"
        if not self.updated_at:
            self.updated_at = datetime.utcnow().isoformat() + "Z"


# Per-document event queues for SSE streams
_document_queues: dict[int, queue_module.Queue] = {}


def _now() -> str:
    """Get current timestamp in ISO format."""
    return datetime.utcnow().isoformat() + "Z"


def start_document(document_id: int, step: str, message: str = "") -> None:
    """Start tracking document analysis progress."""
    with _lock:
        _document_progress[document_id] = DocumentProgressState(
            document_id=document_id,
            status="processing",
            step=step,
            message=message,
        )


def update_document(
    document_id: int,
    step: Optional[str] = None,
    message: Optional[str] = None,
    status: Optional[str] = None,
) -> None:
    """Update document analysis progress."""
    with _lock:
        state = _document_progress.get(document_id)
        if not state:
            return
        if step is not None:
            state.step = step
        if message is not None:
            state.message = message
        if status is not None:
            state.status = status
        state.updated_at = _now()
        _emit_document_event(document_id)


def append_document_chunk(document_id: int, chunk: str) -> None:
    """Append chunk to document response preview."""
    if not chunk:
        return
    MAX_RESPONSE_CHARS = 4000
    with _lock:
        state = _document_progress.get(document_id)
        if not state:
            return
        state.response_preview = (state.response_preview + chunk)[-MAX_RESPONSE_CHARS:]
        state.last_chunk_at = _now()
        state.updated_at = _now()
        _emit_document_event(document_id)


def set_document_error(document_id: int, error: str, status: str = "failed") -> None:
    """Set document analysis error."""
    with _lock:
        state = _document_progress.get(document_id)
        if not state:
            return
        state.error = error
        state.status = status
        state.done = True
        state.updated_at = _now()
        _emit_document_event(document_id)


def complete_document(document_id: int, status: str = "completed") -> None:
    """Mark document analysis as complete."""
    with _lock:
        state = _document_progress.get(document_id)
        if not state:
            return
        state.status = status
        state.done = True
        state.updated_at = _now()
        _emit_document_event(document_id)


def get_document_progress(document_id: int) -> Optional[dict]:
    """Get current document analysis progress."""
    with _lock:
        state = _document_progress.get(document_id)
        if not state:
            return None
        return asdict(state)


def _get_document_queue(document_id: int) -> queue_module.Queue:
    """Get or create event queue for a document."""
    if document_id not in _document_queues:
        _document_queues[document_id] = queue_module.Queue(maxsize=100)
    return _document_queues[document_id]


def _emit_document_event(document_id: int) -> None:
    """Emit current document progress state to its event queue."""
    state = _document_progress.get(document_id)
    if not state:
        return
    try:
        _get_document_queue(document_id).put_nowait(asdict(state))
    except queue_module.Full:
        pass  # Drop if queue is full


def get_next_document_event(document_id: int, timeout: float = 15.0) -> Optional[dict]:
    """Get next document progress event, blocking up to timeout seconds."""
    try:
        event = _get_document_queue(document_id).get(timeout=timeout)
        return event
    except queue_module.Empty:
        return None


# Aliases for backward compatibility
start = start_document
update = update_document
append_chunk = append_document_chunk
set_error = set_document_error
complete = complete_document
get = get_document_progress
get_progress_event = get_next_document_event  # Alias for documents.py

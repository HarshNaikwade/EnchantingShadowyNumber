"""Simple thread-safe analysis progress tracking."""
import json
from dataclasses import dataclass, asdict
from typing import Optional
import queue as queue_module

# Thread-safe queue for all events
_event_queue: queue_module.Queue = queue_module.Queue(maxsize=1000)


@dataclass
class AnalysisEvent:
    """Event sent to clients during analysis."""
    type: str  # "started", "clause_progress", "clause_completed", "completed", "error"
    clause_id: Optional[int] = None
    clause_number: Optional[int] = None
    total_clauses: Optional[int] = None
    message: Optional[str] = None
    understanding: Optional[str] = None


def get_event_json(event: AnalysisEvent) -> str:
    """Convert event to SSE format JSON string."""
    return json.dumps(asdict(event))


def emit_event(event: AnalysisEvent):
    """Emit an event (thread-safe)."""
    try:
        _event_queue.put_nowait(event)
    except queue_module.Full:
        pass  # Drop if queue is full


def emit_started(total_clauses: int):
    """Emit analysis started event."""
    emit_event(AnalysisEvent(
        type="started",
        total_clauses=total_clauses,
        message="Analysis started"
    ))


def emit_clause_progress(clause_id: int, clause_number: int, total_clauses: int, message: str):
    """Emit clause analysis progress event."""
    emit_event(AnalysisEvent(
        type="clause_progress",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        message=message
    ))


def emit_clause_completed(clause_id: int, clause_number: int, total_clauses: int, understanding: str):
    """Emit clause completed event."""
    emit_event(AnalysisEvent(
        type="clause_completed",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        understanding=understanding,
        message="Clause analysis completed"
    ))


def emit_completed():
    """Emit analysis completed event."""
    emit_event(AnalysisEvent(
        type="completed",
        message="Analysis completed"
    ))


def emit_error(message: str):
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

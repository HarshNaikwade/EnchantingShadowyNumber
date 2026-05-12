
"""Analysis progress tracking for real-time SSE updates."""
import asyncio
import json
import queue as queue_module
import threading
from typing import Callable, Optional
from dataclasses import dataclass, asdict

# Thread-safe queue for cross-thread communication
_event_queue: queue_module.Queue = queue_module.Queue()

# Global event system for SSE
_subscribers: list[asyncio.Queue] = []
_subscribers_lock = threading.Lock()

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



async def subscribe() -> asyncio.Queue:
    """Subscribe to analysis progress events. Returns a queue for this subscriber."""
    with _subscribers_lock:
        queue = asyncio.Queue()
        _subscribers.append(queue)
    return queue


async def unsubscribe(queue: asyncio.Queue):
    """Unsubscribe from analysis progress events."""
    with _subscribers_lock:
        if queue in _subscribers:
            _subscribers.remove(queue)

async def emit_event(event: AnalysisEvent):
    """Emit an event to all subscribers (thread-safe)."""
    # Put event in thread-safe queue
    _event_queue.put(event)
    # Also try direct emit if loop is available
    try:
        with _subscribers_lock:
            subs = _subscribers.copy()
        for q in subs:
            try:
                await q.put(event)
            except:
                pass
    except:
        pass


async def emit_started(total_clauses: int):
    """Emit analysis started event."""
    await emit_event(AnalysisEvent(
        type="started",
        total_clauses=total_clauses,
        message="Analysis started"
    ))


async def emit_clause_progress(clause_id: int, clause_number: int, total_clauses: int, message: str):
    """Emit clause analysis progress event."""
    await emit_event(AnalysisEvent(
        type="clause_progress",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        message=message
    ))


async def emit_clause_completed(clause_id: int, clause_number: int, total_clauses: int, understanding: str):
    """Emit clause completed event."""
    await emit_event(AnalysisEvent(
        type="clause_completed",
        clause_id=clause_id,
        clause_number=clause_number,
        total_clauses=total_clauses,
        understanding=understanding,
        message="Clause analysis completed"
    ))


async def emit_completed():
    """Emit analysis completed event."""
    await emit_event(AnalysisEvent(
        type="completed",
        message="Analysis completed"
    ))


async def emit_error(message: str):
    """Emit analysis error event."""
    await emit_event(AnalysisEvent(
        type="error",
        message=message
    ))

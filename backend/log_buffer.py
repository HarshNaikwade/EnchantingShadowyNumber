import logging
import traceback
from collections import deque
from datetime import datetime

MAX_LOG_ENTRIES = 500
_log_buffer = deque(maxlen=MAX_LOG_ENTRIES)


class LogBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
            if record.exc_info:
                message = message + "\n" + "".join(traceback.format_exception(*record.exc_info))
            entry = {
                "ts": datetime.utcnow().isoformat() + "Z",
                "level": record.levelname,
                "logger": record.name,
                "message": message,
            }
            _log_buffer.append(entry)
        except Exception:
            # Never break logging.
            pass


buffer_handler = LogBufferHandler()


def get_logs(limit: int = 200) -> list[dict]:
    if limit <= 0:
        return []
    items = list(_log_buffer)
    return items[-limit:]

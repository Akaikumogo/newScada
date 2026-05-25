from __future__ import annotations

from collections import deque
from typing import Any

MAX_RECENT_LOGS = 1000

_recent_logs: deque[dict[str, Any]] = deque(maxlen=MAX_RECENT_LOGS)


def remember_log(event: dict[str, Any]) -> None:
    _recent_logs.appendleft(event)


def matches_log_filter(
    event: dict[str, Any],
    *,
    device_id: int | None = None,
    register_code: int | None = None,
    signal_name: str | None = None,
) -> bool:
    if event.get("type") != "signal_log":
        return False
    if device_id is not None and event.get("device_id") != device_id:
        return False
    if register_code is not None and event.get("register_code") != register_code:
        return False
    if signal_name and signal_name.lower() not in str(event.get("signal_name", "")).lower():
        return False
    return True


def recent_logs(
    *,
    device_id: int | None = None,
    register_code: int | None = None,
    signal_name: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    return [
        event
        for event in _recent_logs
        if matches_log_filter(
            event,
            device_id=device_id,
            register_code=register_code,
            signal_name=signal_name,
        )
    ][:limit]

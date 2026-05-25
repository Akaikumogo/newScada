from __future__ import annotations

from fastapi import APIRouter, Query

from app.infrastructure.events.log_stream import recent_logs

router = APIRouter(prefix="/log", tags=["log"])


@router.get("/recent")
async def get_recent_logs(
    device_id: int | None = None,
    register_code: int | None = None,
    signal_name: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
):
    return {
        "items": recent_logs(
            device_id=device_id,
            register_code=register_code,
            signal_name=signal_name,
            limit=limit,
        )
    }

from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import HealthOut
from app.api.dependencies import get_db
from app.application.services.record_collector import record_collector
from app.core.config import settings
from app.infrastructure.cache.redis_cache import is_redis_available
from app.infrastructure.events.bus import bus

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthOut)
async def health(db: AsyncSession = Depends(get_db)):
    # DB check
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    # Redis check
    if is_redis_available():
        redis_status = "ok"
    else:
        redis_status = "in-memory"

    return HealthOut(
        status="ok",
        db=db_status,
        redis=redis_status,
        ws_subscribers=bus.subscriber_count,
    )


@router.get("/record-collector")
async def record_collector_health():
    return record_collector.status


@router.get("/logs")
async def latest_logs(lines: int = Query(200, ge=1, le=2000)):
    path = Path(settings.LOG_FILE)
    if not path.exists():
        return {"file": str(path), "lines": []}
    data = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"file": str(path), "lines": data[-lines:]}

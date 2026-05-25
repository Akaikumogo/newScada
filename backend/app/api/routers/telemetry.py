"""
Telemetry router:
  GET /api/telemetry/live?substation_id=   — latest values from Redis
  GET /api/telemetry/history               — time-series from DB (Record table)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import DeviceLiveData, LiveSignalValue, RecordOut
from app.infrastructure.cache.redis_cache import (
    get_all_device_signals,
    get_all_device_statuses,
)
from app.infrastructure.db.models import Device, DeviceSignal, Record

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


# ──────────────────────────────────────────────
#  Live
# ──────────────────────────────────────────────

@router.get("/live", response_model=list[DeviceLiveData])
async def get_live(
    substation_id: int | None = Query(None),
    device_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Device)
    if substation_id is not None:
        q = q.where(Device.substation_id == substation_id)
    if device_id is not None:
        q = q.where(Device.id == device_id)
    devices = (await db.execute(q)).scalars().all()

    if not devices:
        return []

    device_ids = [d.id for d in devices]
    statuses = await get_all_device_statuses(device_ids)

    # Get all signals for these devices
    sig_q = select(DeviceSignal).where(DeviceSignal.device_id.in_(device_ids))
    all_signals = (await db.execute(sig_q)).scalars().all()
    # group by device_id
    sig_map: dict[int, list[DeviceSignal]] = {}
    for s in all_signals:
        sig_map.setdefault(s.device_id, []).append(s)

    result: list[DeviceLiveData] = []
    for device in devices:
        cached = await get_all_device_signals(device.id)
        status = statuses.get(device.id, {})
        sigs: list[LiveSignalValue] = []
        for sig in sig_map.get(device.id, []):
            entry = cached.get(sig.signal_name)
            sigs.append(LiveSignalValue(
                signal_name=sig.signal_name,
                value=entry["value"] if entry else None,
                quality=entry.get("quality", 0) if entry else 0,
                ts=entry.get("ts") if entry else None,
            ))
        result.append(DeviceLiveData(
            device_id=device.id,
            online=status.get("online", False),
            last_seen=status.get("last_seen"),
            signals=sigs,
        ))
    return result


# ──────────────────────────────────────────────
#  History
# ──────────────────────────────────────────────

RANGE_DELTAS = {
    "1h":  timedelta(hours=1),
    "6h":  timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d":  timedelta(days=7),
}

MAX_POINTS = 1000  # down-sample guard


@router.get("/history", response_model=list[RecordOut])
async def get_history(
    device_id: int = Query(...),
    signal_name: str = Query(...),
    range: str = Query("1h", pattern="^(1h|6h|24h|7d)$"),
    db: AsyncSession = Depends(get_db),
):
    delta = RANGE_DELTAS[range]
    since = datetime.now(tz=timezone.utc) - delta

    q = (
        select(Record)
        .where(
            Record.device_id == device_id,
            Record.signal_name == signal_name,
            Record.captured_at >= since,
        )
        .order_by(Record.captured_at.asc())
        .limit(MAX_POINTS)
    )
    records = (await db.execute(q)).scalars().all()
    return records


# ──────────────────────────────────────────────
#  History — paginated (infinite scroll)
# ──────────────────────────────────────────────

PAGE_SIZE = 100


@router.get("/history/page", response_model=list[RecordOut])
async def get_history_page(
    device_id: int = Query(...),
    signal_name: str = Query(...),
    range: str = Query("1h", pattern="^(1h|6h|24h|7d)$"),
    cursor: int | None = Query(None, description="Oxirgi ko'rilgan record id (keyingi sahifa uchun)"),
    limit: int = Query(PAGE_SIZE, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Sahifalangan tarix — infinite scroll uchun.
    Yangi yozuvlar birinchi (desc). cursor = oxirgi ko'rgan id.
    """
    delta = RANGE_DELTAS[range]
    since = datetime.now(tz=timezone.utc) - delta

    q = (
        select(Record)
        .where(
            Record.device_id == device_id,
            Record.signal_name == signal_name,
            Record.captured_at >= since,
        )
    )

    if cursor is not None:
        q = q.where(Record.id < cursor)

    q = q.order_by(Record.captured_at.desc()).limit(limit)

    records = (await db.execute(q)).scalars().all()
    return records

"""
Telemetry router:
  GET /api/telemetry/live?substation_id=   — latest values from Redis
  GET /api/telemetry/history               — time-series from DB (fixed presets)
  GET /api/telemetry/history/page          — cursor-paginated history
  GET /api/telemetry/range                 — custom-range with adaptive bucketing
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import DeviceLiveData, LiveSignalValue, RangePoint, RecordOut
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
    "15m": timedelta(minutes=15),
    "1h":  timedelta(hours=1),
    "6h":  timedelta(hours=6),
    "1d":  timedelta(days=1),
    "1w":  timedelta(days=7),
    "1mo": timedelta(days=30),
    "3mo": timedelta(days=90),
    "1y":  timedelta(days=365),
}

MAX_POINTS = 1000  # down-sample guard
RANGE_PATTERN = "^(15m|1h|6h|1d|1w|1mo|3mo|1y)$"


@router.get("/history", response_model=list[RecordOut])
async def get_history(
    device_id: int = Query(...),
    signal_name: str = Query(...),
    range: str = Query("1h", pattern=RANGE_PATTERN),
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
    range: str = Query("1h", pattern=RANGE_PATTERN),
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


# ──────────────────────────────────────────────
#  Range — custom from/to with adaptive bucketing
# ──────────────────────────────────────────────
#
#  For trading-view-style charts: caller passes from_ts/to_ts and the
#  server picks a bucket size that yields ~TARGET_POINTS aggregated rows.
#
#  Bucket math:  bucket_sec = max(1, ceil(duration_sec / TARGET_POINTS))
#  Aggregation:  to_timestamp(floor(epoch / bucket_sec) * bucket_sec)
#
#  Returns OHLC-like buckets: open, high, low, close, avg, count.
#
TARGET_POINTS = 1500   # ~ chart pixel width on a 1920px display
MAX_BUCKET_SEC = 86400 * 7  # cap bucket size at 1 week (huge ranges)


@router.get("/range", response_model=list[RangePoint])
async def get_history_range(
    device_id:   int      = Query(..., ge=1),
    signal_name: str      = Query(..., min_length=1),
    from_ts:     datetime = Query(..., description="ISO timestamp, inclusive"),
    to_ts:       datetime = Query(..., description="ISO timestamp, exclusive"),
    target_points: int    = Query(TARGET_POINTS, ge=50, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """
    Range query with adaptive bucketing for trading-style charts.
    The server auto-picks a time-bucket size to return ~target_points rows.
    """
    if to_ts <= from_ts:
        return []

    duration_sec = (to_ts - from_ts).total_seconds()
    # Pick bucket size — yields roughly target_points aggregated rows
    bucket_sec = max(1, int(duration_sec / target_points))
    bucket_sec = min(bucket_sec, MAX_BUCKET_SEC)

    # PostgreSQL aggregation: floor epoch into bucket-sized slots.
    # No TimescaleDB required — standard SQL only.
    sql = text("""
        SELECT
            to_timestamp(
                floor(EXTRACT(EPOCH FROM captured_at) / :bucket_sec) * :bucket_sec
            )                                               AS ts,
            (array_agg(value ORDER BY captured_at ASC))[1]  AS open,
            MAX(value)                                      AS high,
            MIN(value)                                      AS low,
            (array_agg(value ORDER BY captured_at DESC))[1] AS close,
            AVG(value)                                      AS avg,
            COUNT(*)                                        AS count
        FROM record
        WHERE device_id   = :device_id
          AND signal_name = :signal_name
          AND captured_at >= :from_ts
          AND captured_at <  :to_ts
        GROUP BY 1
        ORDER BY 1
    """)

    result = await db.execute(sql, {
        "bucket_sec":   bucket_sec,
        "device_id":    device_id,
        "signal_name":  signal_name,
        "from_ts":      from_ts,
        "to_ts":        to_ts,
    })

    rows = result.fetchall()
    return [
        RangePoint(
            ts=row.ts,
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            avg=float(row.avg),
            count=int(row.count),
        )
        for row in rows
    ]


# ──────────────────────────────────────────────
#  Range — batch (all active signals at once)
# ──────────────────────────────────────────────
#
#  For multi-line trading charts: server auto-detects active signals
#  for the device — caller just passes device_id.
#
#  Optional: pass signal_name=... query params to restrict to a subset.
#
@router.get("/range/multi", response_model=dict[str, list[RangePoint]])
async def get_history_range_multi(
    device_id:     int                  = Query(..., ge=1),
    signal_names:  list[str] | None     = Query(None, alias="signal_name"),
    from_ts:       datetime             = Query(...),
    to_ts:         datetime             = Query(...),
    target_points: int                  = Query(TARGET_POINTS, ge=50, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch range query for a device's signals — one round-trip, one SQL
    aggregation.

    If `signal_name` query params are omitted, the server returns history
    for ALL active (or only_realtime) signals on this device.

    To restrict to a subset, pass repeated query params:
       ?signal_name=U_A&signal_name=U_B
    """
    if to_ts <= from_ts:
        return {}

    # ── Resolve which signals to query ──────────────────
    if not signal_names:
        # Auto: all active/realtime signals for this device
        sig_q = select(DeviceSignal.signal_name).where(
            DeviceSignal.device_id == device_id,
            (DeviceSignal.active.is_(True)) | (DeviceSignal.only_realtime.is_(True)),
        )
        signal_names = [row[0] for row in (await db.execute(sig_q)).all()]

    if not signal_names:
        return {}

    duration_sec = (to_ts - from_ts).total_seconds()
    bucket_sec = max(1, int(duration_sec / target_points))
    bucket_sec = min(bucket_sec, MAX_BUCKET_SEC)

    sql = text("""
        SELECT
            signal_name                                     AS sig,
            to_timestamp(
                floor(EXTRACT(EPOCH FROM captured_at) / :bucket_sec) * :bucket_sec
            )                                               AS ts,
            (array_agg(value ORDER BY captured_at ASC))[1]  AS open,
            MAX(value)                                      AS high,
            MIN(value)                                      AS low,
            (array_agg(value ORDER BY captured_at DESC))[1] AS close,
            AVG(value)                                      AS avg,
            COUNT(*)                                        AS count
        FROM record
        WHERE device_id   = :device_id
          AND signal_name = ANY(:signal_names)
          AND captured_at >= :from_ts
          AND captured_at <  :to_ts
        GROUP BY signal_name, 2
        ORDER BY signal_name, 2
    """)

    result = await db.execute(sql, {
        "bucket_sec":   bucket_sec,
        "device_id":    device_id,
        "signal_names": list(signal_names),
        "from_ts":      from_ts,
        "to_ts":        to_ts,
    })

    grouped: dict[str, list[RangePoint]] = {name: [] for name in signal_names}
    for row in result.fetchall():
        grouped[row.sig].append(RangePoint(
            ts=row.ts,
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            avg=float(row.avg),
            count=int(row.count),
        ))
    return grouped


# ──────────────────────────────────────────────
#  Diff — same signal_title across multiple devices
# ──────────────────────────────────────────────
#
#  Diff queries are by signal_title (human label) rather than
#  signal_name, because the same logical signal (e.g. "Ктр IA")
#  may have different register codes / signal_names on each device.
#

@router.get("/diff/signals", response_model=list[dict])
async def list_diff_signals(
    substation_id: int | None = Query(None, description="Filter by substation"),
    min_devices:   int        = Query(2, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """
    Distinct signal_titles with the number of devices that have them
    (active/realtime).  Used by the Diff page's title picker.

    If `substation_id` is given, only devices in that substation are counted.
    """
    sql = text("""
        SELECT
            ds.signal_title,
            COUNT(DISTINCT ds.device_id)                  AS device_count,
            MIN(ds.unit)                                  AS unit,
            (array_agg(DISTINCT ds.signal_name))[1:3]     AS sample_names
        FROM device_signal ds
        JOIN device d ON d.id = ds.device_id
        WHERE (ds.active = true OR ds.only_realtime = true)
          AND ds.signal_title IS NOT NULL
          AND ds.signal_title <> ''
          AND (:substation_id IS NULL OR d.substation_id = :substation_id)
        GROUP BY ds.signal_title
        HAVING COUNT(DISTINCT ds.device_id) >= :min_devices
        ORDER BY device_count DESC, ds.signal_title
    """)
    result = await db.execute(sql, {
        "min_devices":   min_devices,
        "substation_id": substation_id,
    })
    return [
        {
            "signal_title": row.signal_title,
            "device_count": int(row.device_count),
            "unit":         row.unit,
            "sample_names": list(row.sample_names) if row.sample_names else [],
        }
        for row in result.fetchall()
    ]


@router.get("/diff", response_model=dict[int, list[RangePoint]])
async def get_diff(
    signal_title:  str               = Query(..., min_length=1),
    substation_id: int | None        = Query(None, description="Filter to one substation"),
    from_ts:       datetime          = Query(...),
    to_ts:         datetime          = Query(...),
    target_points: int               = Query(TARGET_POINTS, ge=50, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-device range query for a single signal_title.

    Each device may have its own signal_name for the same title — we
    JOIN record with device_signal so the per-device mapping is correct.

    If `substation_id` is provided, only devices in that substation are returned.

    Returns { device_id: RangePoint[] }.
    """
    if to_ts <= from_ts:
        return {}

    # Devices that define this title (active/realtime), optionally scoped
    sig_q = select(DeviceSignal.device_id).where(
        DeviceSignal.signal_title == signal_title,
        (DeviceSignal.active.is_(True)) | (DeviceSignal.only_realtime.is_(True)),
    ).distinct()
    if substation_id is not None:
        sig_q = sig_q.join(Device, Device.id == DeviceSignal.device_id).where(
            Device.substation_id == substation_id
        )

    device_ids = [row[0] for row in (await db.execute(sig_q)).all()]
    grouped: dict[int, list[RangePoint]] = {dev_id: [] for dev_id in device_ids}

    if not device_ids:
        return grouped

    duration_sec = (to_ts - from_ts).total_seconds()
    bucket_sec = max(1, int(duration_sec / target_points))
    bucket_sec = min(bucket_sec, MAX_BUCKET_SEC)

    # JOIN record with device_signal so each device's own signal_name
    # is matched against its records.  Substation filter applied via device_ids.
    sql = text("""
        WITH pairs AS (
            SELECT device_id, signal_name
            FROM device_signal
            WHERE signal_title = :signal_title
              AND (active = true OR only_realtime = true)
              AND device_id = ANY(:device_ids)
        )
        SELECT
            r.device_id                                       AS dev,
            to_timestamp(
                floor(EXTRACT(EPOCH FROM r.captured_at) / :bucket_sec) * :bucket_sec
            )                                                 AS ts,
            (array_agg(r.value ORDER BY r.captured_at ASC))[1]  AS open,
            MAX(r.value)                                      AS high,
            MIN(r.value)                                      AS low,
            (array_agg(r.value ORDER BY r.captured_at DESC))[1] AS close,
            AVG(r.value)                                      AS avg,
            COUNT(*)                                          AS count
        FROM record r
        JOIN pairs p
          ON p.device_id   = r.device_id
         AND p.signal_name = r.signal_name
        WHERE r.captured_at >= :from_ts
          AND r.captured_at <  :to_ts
        GROUP BY r.device_id, 2
        ORDER BY r.device_id, 2
    """)

    result = await db.execute(sql, {
        "bucket_sec":   bucket_sec,
        "signal_title": signal_title,
        "device_ids":   device_ids,
        "from_ts":      from_ts,
        "to_ts":        to_ts,
    })

    for row in result.fetchall():
        grouped[row.dev].append(RangePoint(
            ts=row.ts,
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            avg=float(row.avg),
            count=int(row.count),
        ))
    return grouped

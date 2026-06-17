"""
Telemetry router:
  GET /api/telemetry/live?substation_id=   — latest values from Redis
  GET /api/telemetry/history               — time-series from DB (fixed presets)
  GET /api/telemetry/history/page          — cursor-paginated history
  GET /api/telemetry/range                 — custom-range with adaptive bucketing
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import DeviceLiveData, LiveSignalValue, RangePoint, RecordOut
from app.infrastructure.cache.redis_cache import (
    get_all_device_statuses,
    get_many_signal_values,
)
from app.infrastructure.db.models import Device, DeviceSignal, Record

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _activity_bucket_sec(from_ts: datetime, to_ts: datetime) -> int:
    duration_sec = max(60, int((to_ts - from_ts).total_seconds()))
    return max(60, min(3600, int(ceil(duration_sec / 240))))


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

    # Get only live-visible signals and read exact Redis keys in one MGET.
    sig_q = select(DeviceSignal).where(
        DeviceSignal.device_id.in_(device_ids),
        (DeviceSignal.active.is_(True)) | (DeviceSignal.only_realtime.is_(True)),
    )
    all_signals = (await db.execute(sig_q)).scalars().all()
    cached_values = await get_many_signal_values([
        (signal.device_id, signal.signal_name)
        for signal in all_signals
    ])
    # group by device_id
    sig_map: dict[int, list[DeviceSignal]] = {}
    for s in all_signals:
        sig_map.setdefault(s.device_id, []).append(s)

    result: list[DeviceLiveData] = []
    for device in devices:
        status = statuses.get(device.id, {})
        sigs: list[LiveSignalValue] = []
        for sig in sig_map.get(device.id, []):
            entry = cached_values.get((device.id, sig.signal_name))
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
#  First / Last — delta accounting helper
# ──────────────────────────────────────────────
#
#  Returns the very first and very last recorded value within [from_ts, to_ts).
#  Used by formula blocks for delta calculations:
#    kunlik_kirish = last(A+, 00:00..24:00) - first(A+, 00:00..24:00)
#

@router.get("/first-last")
async def get_first_last(
    device_id:   int      = Query(..., ge=1),
    signal_name: str      = Query(..., min_length=1),
    from_ts:     datetime = Query(..., description="Range start (inclusive)"),
    to_ts:       datetime = Query(..., description="Range end (exclusive)"),
    db: AsyncSession = Depends(get_db),
):
    if to_ts <= from_ts:
        return {"first": None, "last": None, "first_ts": None, "last_ts": None}

    base = (
        Record.device_id   == device_id,
        Record.signal_name == signal_name,
        Record.captured_at >= from_ts,
        Record.captured_at <  to_ts,
    )

    first_rec = (await db.execute(
        select(Record).where(*base).order_by(Record.captured_at.asc()).limit(1)
    )).scalar_one_or_none()

    last_rec = (await db.execute(
        select(Record).where(*base).order_by(Record.captured_at.desc()).limit(1)
    )).scalar_one_or_none()

    return {
        "first":    float(first_rec.value)             if first_rec else None,
        "last":     float(last_rec.value)              if last_rec  else None,
        "first_ts": first_rec.captured_at.isoformat()  if first_rec else None,
        "last_ts":  last_rec.captured_at.isoformat()   if last_rec  else None,
    }


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
    sub_filter = "AND d.substation_id = :substation_id" if substation_id is not None else ""
    sql = text(f"""
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
          {sub_filter}
        GROUP BY ds.signal_title
        HAVING COUNT(DISTINCT ds.device_id) >= :min_devices
        ORDER BY device_count DESC, ds.signal_title
    """)
    params: dict = {"min_devices": min_devices}
    if substation_id is not None:
        params["substation_id"] = substation_id
    result = await db.execute(sql, params)
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


@router.get("/device-activity", response_model=dict)
async def get_device_activity(
    from_ts:       datetime      = Query(...),
    to_ts:         datetime      = Query(...),
    substation_id: int | None    = Query(None),
    device_id:     int | None    = Query(None),
    bucket_sec:    int | None    = Query(None, ge=60, le=86400),
    db: AsyncSession = Depends(get_db),
):
    """
    Device activity timeline based on persisted record rows.

    A bucket is active when at least one record exists for that device inside
    the bucket. Inactive bucket ranges are returned as outages.
    """
    bucket = bucket_sec or _activity_bucket_sec(from_ts, to_ts)
    duration_sec = max(1, int((to_ts - from_ts).total_seconds()))
    # Clamp bucket count to max 480 to keep payloads sane
    if duration_sec / bucket > 480:
        bucket = max(60, int(ceil(duration_sec / 480)))

    empty = {"from_ts": from_ts, "to_ts": to_ts, "bucket_sec": bucket, "devices": []}
    if to_ts <= from_ts:
        return empty

    devices_q = select(Device)
    if substation_id is not None:
        devices_q = devices_q.where(Device.substation_id == substation_id)
    if device_id is not None:
        devices_q = devices_q.where(Device.id == device_id)
    devices = (await db.execute(devices_q.order_by(Device.id))).scalars().all()
    if not devices:
        return empty

    device_ids = [d.id for d in devices]
    bucket_count = max(1, int(ceil(duration_sec / bucket)))
    from_epoch = from_ts.timestamp()

    # Single query: bucket-level aggregates + per-device totals via SQL
    sql = text("""
        SELECT
            device_id,
            floor((EXTRACT(EPOCH FROM captured_at) - :from_epoch) / :bucket_sec)::int AS bidx,
            COUNT(*)::int AS cnt
        FROM record
        WHERE device_id = ANY(:device_ids)
          AND captured_at >= :from_ts
          AND captured_at <  :to_ts
        GROUP BY device_id, bidx
        ORDER BY device_id, bidx
    """)
    rows = (await db.execute(sql, {
        "device_ids": device_ids,
        "from_ts": from_ts,
        "to_ts": to_ts,
        "bucket_sec": bucket,
        "from_epoch": from_epoch,
    })).fetchall()

    # Device-level first/last seen in one aggregate query
    agg_sql = text("""
        SELECT device_id, MIN(captured_at) AS first_seen, MAX(captured_at) AS last_seen
        FROM record
        WHERE device_id = ANY(:device_ids)
          AND captured_at >= :from_ts AND captured_at < :to_ts
        GROUP BY device_id
    """)
    agg_rows = (await db.execute(agg_sql, {
        "device_ids": device_ids,
        "from_ts": from_ts,
        "to_ts": to_ts,
    })).fetchall()
    agg_map = {r.device_id: (r.first_seen, r.last_seen) for r in agg_rows}

    # Build sparse bucket maps: device_id -> {bidx: count}
    by_device: dict[int, dict[int, int]] = {did: {} for did in device_ids}
    for row in rows:
        bidx = row.bidx
        if 0 <= bidx < bucket_count:
            by_device[row.device_id][bidx] = row.cnt

    result_devices: list[dict] = []
    for device in devices:
        bmap = by_device.get(device.id, {})
        active_count = len(bmap)
        total_records = sum(bmap.values())
        first_seen, last_seen = agg_map.get(device.id, (None, None))

        # Build timeline + outages in a single pass using integer arithmetic
        timeline: list[dict] = []
        outages: list[dict] = []
        outage_start: int | None = None

        for idx in range(bucket_count):
            cnt = bmap.get(idx, 0)
            active = cnt > 0
            if active and outage_start is not None:
                s = from_epoch + outage_start * bucket
                e = from_epoch + idx * bucket
                outages.append({
                    "from_ts": datetime.fromtimestamp(s, tz=timezone.utc),
                    "to_ts": datetime.fromtimestamp(e, tz=timezone.utc),
                    "duration_sec": int(e - s),
                })
                outage_start = None
            elif not active and outage_start is None:
                outage_start = idx

            timeline.append({
                "ts": datetime.fromtimestamp(from_epoch + idx * bucket, tz=timezone.utc),
                "active": active,
                "record_count": cnt,
            })

        if outage_start is not None:
            s = from_epoch + outage_start * bucket
            e = min(to_ts.timestamp(), from_epoch + bucket_count * bucket)
            outages.append({
                "from_ts": datetime.fromtimestamp(s, tz=timezone.utc),
                "to_ts": datetime.fromtimestamp(e, tz=timezone.utc),
                "duration_sec": int(e - s),
            })

        uptime_percent = round((active_count / bucket_count) * 100, 2)
        result_devices.append({
            "device_id": device.id,
            "name": device.name,
            "common_address": device.iec104_common_address,
            "bucket_count": bucket_count,
            "active_buckets": active_count,
            "uptime_percent": uptime_percent,
            "downtime_percent": round(100 - uptime_percent, 2),
            "total_records": total_records,
            "first_seen": first_seen,
            "last_seen": last_seen,
            "outages": outages,
            "timeline": timeline,
        })

    return {
        "from_ts": from_ts,
        "to_ts": to_ts,
        "bucket_sec": bucket,
        "devices": result_devices,
    }

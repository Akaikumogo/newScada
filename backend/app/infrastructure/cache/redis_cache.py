"""
Redis cache layer — stores latest signal values & publishes WS events.
Falls back to an in-memory dict when Redis is not available.

Key layout:
  live:{device_id}:{signal_name}  → {value, quality, ts}
  device:status:{device_id}       → {online, last_seen}
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
#  In-memory fallback
# ──────────────────────────────────────────────

_mem_store: dict[str, str] = {}  # key → JSON string


class _MemStore:
    """Mimics the subset of the redis.asyncio API we use."""

    async def ping(self) -> bool:
        return True

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        _mem_store[key] = value

    async def get(self, key: str) -> str | None:
        return _mem_store.get(key)

    async def mget(self, *keys: str) -> list[str | None]:
        return [_mem_store.get(k) for k in keys]

    async def mset(self, mapping: dict[str, str]) -> None:
        _mem_store.update(mapping)

    async def keys(self, pattern: str) -> list[str]:
        # simple glob: "live:1:*" → starts-with prefix
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return [k for k in _mem_store if k.startswith(prefix)]
        return [k for k in _mem_store if k == pattern]

    async def publish(self, channel: str, message: str) -> None:
        pass  # in-memory: no pub/sub needed (EventBus handles it)

    async def aclose(self) -> None:
        pass


_redis: Any = None
_redis_available = False
CHANNEL_LIVE = "live_updates"


async def init_redis() -> bool:
    """Try to connect Redis; fall back to in-memory on failure."""
    global _redis, _redis_available
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        r = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await r.ping()
        _redis = r
        _redis_available = True
        logger.info("Redis connected ✓")
        return True
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — using in-memory fallback", exc)
        _redis = _MemStore()
        _redis_available = False
        return False


def get_redis() -> Any:
    global _redis
    if _redis is None:
        _redis = _MemStore()
    return _redis


def is_redis_available() -> bool:
    return _redis_available


async def close_redis() -> None:
    global _redis, _redis_available
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        _redis_available = False


# ──────────────────────────────────────────────
#  Signal values
# ──────────────────────────────────────────────

async def set_signal_value(
    device_id: int,
    signal_name: str,
    value: float,
    quality: int,
    ts: str,
) -> None:
    r = get_redis()
    key = f"live:{device_id}:{signal_name}"
    from app.core.config import settings
    payload = json.dumps({"value": value, "quality": quality, "ts": ts})
    await r.set(key, payload, ex=settings.IEC_LIVE_CACHE_SECONDS)


async def set_many_signal_values(records: list[dict]) -> None:
    """Write many latest values in one Redis pipeline/mset operation."""
    if not records:
        return
    r = get_redis()
    mapping = {
        f"live:{row['device_id']}:{row['signal_name']}": json.dumps({
            "value": row["value"],
            "quality": row["quality"],
            "ts": row["captured_at"].isoformat(),
        })
        for row in records
    }
    if _redis_available and hasattr(r, "pipeline"):
        from app.core.config import settings
        pipe = r.pipeline(transaction=False)
        for key, payload in mapping.items():
            pipe.set(key, payload, ex=settings.IEC_LIVE_CACHE_SECONDS)
        await pipe.execute()
        return
    if hasattr(r, "mset"):
        await r.mset(mapping)
        return
    for key, payload in mapping.items():
        await r.set(key, payload)


async def get_many_signal_values(keys: list[tuple[int, str]]) -> dict[tuple[int, str], Any]:
    """Read exact live keys with one MGET instead of Redis KEYS scans."""
    if not keys:
        return {}
    r = get_redis()
    redis_keys = [f"live:{device_id}:{signal_name}" for device_id, signal_name in keys]
    values = await r.mget(*redis_keys)
    result: dict[tuple[int, str], Any] = {}
    for key, raw in zip(keys, values):
        if raw:
            result[key] = json.loads(raw)
    return result


async def get_signal_value(device_id: int, signal_name: str) -> dict | None:
    r = get_redis()
    raw = await r.get(f"live:{device_id}:{signal_name}")
    return json.loads(raw) if raw else None


async def get_all_device_signals(device_id: int) -> dict[str, Any]:
    r = get_redis()
    pattern = f"live:{device_id}:*"
    keys = await r.keys(pattern)
    result: dict[str, Any] = {}
    if not keys:
        return result
    values = await r.mget(*keys)
    prefix_len = len(f"live:{device_id}:")
    for key, raw in zip(keys, values):
        if raw:
            signal_name = key[prefix_len:]
            result[signal_name] = json.loads(raw)
    return result


# ──────────────────────────────────────────────
#  Device status
# ──────────────────────────────────────────────

async def set_device_status(device_id: int, online: bool, last_seen: str) -> None:
    r = get_redis()
    key = f"device:status:{device_id}"
    payload = json.dumps({"online": online, "last_seen": last_seen})
    from app.core.config import settings
    await r.set(key, payload, ex=settings.IEC_LIVE_CACHE_SECONDS)


async def get_device_status(device_id: int) -> dict | None:
    r = get_redis()
    raw = await r.get(f"device:status:{device_id}")
    return json.loads(raw) if raw else None


async def get_all_device_statuses(device_ids: list[int]) -> dict[int, dict]:
    if not device_ids:
        return {}
    r = get_redis()
    keys = [f"device:status:{did}" for did in device_ids]
    values = await r.mget(*keys)
    result: dict[int, dict] = {}
    for did, raw in zip(device_ids, values):
        if raw:
            result[did] = json.loads(raw)
    return result


# ──────────────────────────────────────────────
#  Pub/Sub (only used with real Redis)
# ──────────────────────────────────────────────

async def publish_live(message: dict) -> None:
    """Publish a live update message (real Redis only)."""
    if _redis_available:
        r = get_redis()
        await r.publish(CHANNEL_LIVE, json.dumps(message))


async def publish_many_live(messages: list[dict]) -> None:
    """Publish many live update messages with one Redis pipeline."""
    if not _redis_available or not messages:
        return
    r = get_redis()
    if hasattr(r, "pipeline"):
        pipe = r.pipeline(transaction=False)
        for message in messages:
            pipe.publish(CHANNEL_LIVE, json.dumps(message))
        await pipe.execute()
        return
    for message in messages:
        await r.publish(CHANNEL_LIVE, json.dumps(message))

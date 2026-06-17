"""
RecordCollector — persistent IEC-104 session manager.

One long-lived TCP connection per device. Receives spontaneous data in
real-time, runs periodic GI for full sync. Smart change detection with
analog deadband and per-signal throttle to minimize DB writes.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import insert, select

from app.core.config import settings
from app.infrastructure.cache.redis_cache import (
    publish_many_live,
    set_device_status,
    set_many_signal_values,
)
from app.infrastructure.db.database import AsyncSessionFactory
from app.infrastructure.db.models import Device, DeviceSignal, Record
from app.infrastructure.events.bus import bus
from app.infrastructure.iec104 import Iec104Session, SessionConfig, SignalValue

logger = logging.getLogger(__name__)
CONFIG_RELOAD_SECONDS = 30.0

# ── Change detection thresholds ────────────────────────────────────────────
ANALOG_DEADBAND = 0.001        # abs diff below this → same value
THROTTLE_SECONDS = 1.0         # max 1 write per signal per second (spontaneous)
GI_THROTTLE_SECONDS = 60.0     # ignore GI if last GI was < 60s ago per device


class RecordCollector:
    def __init__(self) -> None:
        self._sessions: dict[int, Iec104Session] = {}
        self._signal_map: dict[int, dict[int, DeviceSignal]] = {}
        self._flush_task: asyncio.Task | None = None
        self._config_task: asyncio.Task | None = None
        self._stop = asyncio.Event()

        # Change detection: (device_id, signal_name) → (value, quality, last_persist_time)
        self._last_seen: dict[tuple[int, str], tuple[float, int, float]] = {}

        # GI throttle: device_id → last GI persist time
        self._last_gi: dict[int, float] = {}

        # Batched DB writes
        self._buffer: list[dict] = []
        self._buffer_lock = asyncio.Lock()

        # Stats
        self._total_received = 0
        self._total_persisted = 0
        self._total_skipped = 0

    @property
    def is_running(self) -> bool:
        return bool(self._sessions) or (self._flush_task is not None and not self._flush_task.done())

    @property
    def status(self) -> dict:
        return {
            "running": self.is_running,
            "sessions": len(self._sessions),
            "connected": sum(1 for s in self._sessions.values() if s._connected),
            "session_device_ids": sorted(self._sessions),
            "active_device_ids": sorted(self._signal_map),
            "session_hosts": [
                {
                    "device_id": device_id,
                    "host": session.cfg.host,
                    "port": session.cfg.port,
                    "connected": session._connected,
                }
                for device_id, session in sorted(self._sessions.items())
            ],
            "received": self._total_received,
            "persisted": self._total_persisted,
            "skipped": self._total_skipped,
            "buffer": len(self._buffer),
        }

    def start(self) -> None:
        if self.is_running:
            return
        self._stop.clear()
        self._flush_task = asyncio.create_task(self._flush_loop(), name="record-flush")
        self._config_task = asyncio.create_task(self._config_loop(), name="record-config")

    async def stop(self) -> None:
        self._stop.set()
        for session in self._sessions.values():
            await session.stop()
        self._sessions.clear()
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        if self._config_task:
            self._config_task.cancel()
            try:
                await self._config_task
            except asyncio.CancelledError:
                pass
        await self._flush_buffer()
        logger.info("RecordCollector stopped")

    # ── Config reload loop ─────────────────────────────────────────────────

    async def _config_loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._sync_sessions()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("RecordCollector config sync failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=CONFIG_RELOAD_SECONDS)
                return
            except asyncio.TimeoutError:
                pass

    async def _sync_sessions(self) -> None:
        async with AsyncSessionFactory() as db:
            devices = (
                await db.execute(
                    select(Device).where(
                        Device.protocol == "iec104",
                        Device.active.is_(True),
                    ).order_by(Device.id)
                )
            ).scalars().all()

            signals = (
                await db.execute(
                    select(DeviceSignal)
                    .where(
                        (DeviceSignal.active.is_(True))
                        | (DeviceSignal.only_realtime.is_(True))
                    )
                    .order_by(DeviceSignal.device_id, DeviceSignal.register_code)
                )
            ).scalars().all()

        # active_ids — only devices that are active=True (already filtered above)
        active_ids = {d.id for d in devices}
        active_device_map = {d.id: d for d in devices}

        # signal_map — only signals belonging to active devices
        new_signal_map: dict[int, dict[int, DeviceSignal]] = {}
        for sig in signals:
            if sig.device_id in active_ids:
                new_signal_map.setdefault(sig.device_id, {})[sig.register_code] = sig
        self._signal_map = new_signal_map

        # Stop sessions for devices that became inactive or whose host/port changed
        for did in list(self._sessions):
            if did not in active_ids:
                logger.info("RecordCollector stopping session — device %s is inactive", did)
                await self._sessions[did].stop()
                del self._sessions[did]
            else:
                dev = active_device_map[did]
                sess = self._sessions[did]
                if sess.cfg.host != dev.iec104_host or sess.cfg.port != dev.iec104_port:
                    logger.info(
                        "RecordCollector restarting session %s — host changed %s:%s -> %s:%s",
                        did, sess.cfg.host, sess.cfg.port, dev.iec104_host, dev.iec104_port,
                    )
                    await sess.stop()
                    del self._sessions[did]

        for device in devices:
            if device.id not in new_signal_map:
                continue  # active device but no active/RT signals — skip
            if device.id not in self._sessions:
                cfg = SessionConfig(
                    host=device.iec104_host,
                    port=device.iec104_port,
                    common_address=device.iec104_common_address,
                    connect_timeout=settings.IEC_CONNECT_TIMEOUT_SECONDS,
                    initial_gi=settings.IEC_SESSION_INITIAL_GI,
                    gi_interval=settings.IEC_SESSION_GI_INTERVAL,
                    reconnect_delay=settings.IEC_SESSION_RECONNECT_DELAY,
                    reconnect_max=settings.IEC_SESSION_RECONNECT_MAX,
                    keepalive_interval=settings.IEC_SESSION_KEEPALIVE,
                )
                session = Iec104Session(device.id, cfg, self._on_values)
                self._sessions[device.id] = session
                session.start()
                logger.info(
                    "RecordCollector started session for device %s (%s:%s)",
                    device.id, device.iec104_host, device.iec104_port,
                )

    # ── Values callback ────────────────────────────────────────────────────

    async def _on_values(self, device_id: int, values: list[SignalValue], is_gi: bool) -> None:
        ioa_map = self._signal_map.get(device_id, {})
        if not ioa_map:
            return

        now = time.monotonic()
        captured_at = datetime.now(timezone.utc)
        realtime_rows: list[dict] = []
        persist_rows: list[dict] = []

        # GI throttle — skip full persist if recent GI already saved
        gi_skip = False
        if is_gi:
            last_gi = self._last_gi.get(device_id, 0)
            if now - last_gi < GI_THROTTLE_SECONDS:
                gi_skip = True  # treat as spontaneous (change-detect only)
            else:
                self._last_gi[device_id] = now

        for sv in values:
            sig = ioa_map.get(sv.ioa)
            if sig is None:
                continue

            self._total_received += 1
            val = float(sv.value)
            qual = int(sv.quality)
            row = {
                "device_id": device_id,
                "signal_name": sig.signal_name,
                "value": val,
                "quality": qual,
                "captured_at": captured_at,
            }
            realtime_rows.append(row)

            if not sig.active:
                continue

            key = (device_id, sig.signal_name)
            last = self._last_seen.get(key)

            if last is None:
                # First time seeing this signal — always persist
                self._last_seen[key] = (val, qual, now)
                persist_rows.append(row)
                continue

            last_val, last_qual, last_time = last

            # Quality changed → always persist immediately
            if qual != last_qual:
                self._last_seen[key] = (val, qual, now)
                persist_rows.append(row)
                continue

            # GI response (not throttled) → persist as snapshot
            if is_gi and not gi_skip:
                self._last_seen[key] = (val, qual, now)
                persist_rows.append(row)
                continue

            # Analog deadband — ignore tiny floating point diffs
            if abs(val - last_val) < ANALOG_DEADBAND:
                self._total_skipped += 1
                continue

            # Value changed — but check per-signal time throttle
            if now - last_time < THROTTLE_SECONDS:
                # Too soon since last persist — update last_seen but don't persist
                self._last_seen[key] = (val, qual, last_time)  # keep old time
                self._total_skipped += 1
                continue

            # Significant change + enough time passed → persist
            self._last_seen[key] = (val, qual, now)
            persist_rows.append(row)

        # Publish to Redis/WebSocket immediately (real-time, always)
        if realtime_rows:
            await self._publish_realtime(realtime_rows, captured_at)

        # Buffer for DB
        if persist_rows:
            async with self._buffer_lock:
                self._buffer.extend(persist_rows)

    async def _publish_realtime(self, rows: list[dict], captured_at: datetime) -> None:
        await set_many_signal_values(rows)
        ts = captured_at.isoformat()
        for device_id in {row["device_id"] for row in rows}:
            await set_device_status(device_id, True, ts)
            await bus.publish({
                "type": "device_status",
                "device_id": device_id,
                "online": True,
                "last_seen": ts,
            })
        batch = [
            {
                "type": "signal_update",
                "device_id": row["device_id"],
                "signal_name": row["signal_name"],
                "value": row["value"],
                "quality": row["quality"],
                "ts": ts,
            }
            for row in rows
        ]
        if batch:
            await publish_many_live(batch)
            await bus.publish({"type": "signal_batch", "items": batch})

    # ── Batch DB flush ─────────────────────────────────────────────────────

    async def _flush_loop(self) -> None:
        logger.info("RecordCollector flush loop started (interval=%.1fs)", settings.IEC_FLUSH_INTERVAL)
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=settings.IEC_FLUSH_INTERVAL)
                return
            except asyncio.TimeoutError:
                pass
            try:
                await self._flush_buffer()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("RecordCollector flush failed")

    async def _flush_buffer(self) -> None:
        async with self._buffer_lock:
            if not self._buffer:
                return
            rows = self._buffer[:]
            self._buffer.clear()

        if not rows:
            return

        async with AsyncSessionFactory() as session:
            await session.execute(insert(Record), rows)
            await session.commit()

        self._total_persisted += len(rows)
        # Only log large flushes at INFO, small ones silently
        if len(rows) > 1000:
            logger.info("RecordCollector flushed %s rows", len(rows))


record_collector = RecordCollector()

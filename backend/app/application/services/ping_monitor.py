"""
PingMonitor — ICMP-based device online/offline detection.

Runs in the background, pings every device every PING_INTERVAL_SECONDS,
and is the authoritative source for `device_status`.  IEC-104 collector
no longer touches online/offline state — this prevents flapping when
IEC-104 has transient failures while the device is actually reachable.

Cross-platform: uses the OS `ping` command via async subprocess.
"""
from __future__ import annotations

import asyncio
import logging
import platform
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.infrastructure.cache.redis_cache import set_device_status
from app.infrastructure.db.database import AsyncSessionFactory
from app.infrastructure.db.models import Device
from app.infrastructure.events.bus import bus

logger = logging.getLogger(__name__)

_IS_WINDOWS = platform.system() == "Windows"


async def ping_host(host: str, timeout_sec: float = 1.0) -> bool:
    """
    Single-packet ICMP ping. Returns True if host is reachable.
    Uses OS `ping` command (no admin needed, cross-platform).
    """
    if _IS_WINDOWS:
        # Windows: -n count, -w timeout (ms)
        cmd = ["ping", "-n", "1", "-w", str(int(timeout_sec * 1000)), host]
    else:
        # Linux/Mac: -c count, -W timeout (sec)
        cmd = ["ping", "-c", "1", "-W", str(max(1, int(timeout_sec))), host]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout_sec + 1.5)
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return False
        return proc.returncode == 0
    except Exception as exc:
        logger.debug("ping_host(%s) failed: %s", host, exc)
        return False


class PingMonitor:
    """
    Periodic ICMP ping of all devices.

    On state change → updates Redis device_status + emits WS event.
    On steady state → still refreshes last_seen if online (so dispatcher
    knows the device is still alive).
    """

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._states: dict[int, bool] = {}
        self._cycle = 0

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def status(self) -> dict:
        return {
            "running": self.is_running,
            "cycle":   self._cycle,
            "online":  sum(1 for v in self._states.values() if v),
            "total":   len(self._states),
        }

    def start(self) -> None:
        if self.is_running:
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run(), name="ping-monitor")

    async def stop(self) -> None:
        if not self._task:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

    async def _run(self) -> None:
        logger.info(
            "PingMonitor started (interval=%ss, timeout=%ss, parallel=%s)",
            settings.PING_INTERVAL_SECONDS,
            settings.PING_TIMEOUT_SECONDS,
            settings.PING_MAX_PARALLEL,
        )
        while not self._stop_event.is_set():
            try:
                await self._cycle_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("PingMonitor cycle failed")
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=settings.PING_INTERVAL_SECONDS,
                )
            except asyncio.TimeoutError:
                pass
        logger.info("PingMonitor stopped")

    async def _cycle_once(self) -> None:
        self._cycle += 1

        async with AsyncSessionFactory() as session:
            devices = (await session.execute(select(Device))).scalars().all()

        if not devices:
            return

        sem = asyncio.Semaphore(settings.PING_MAX_PARALLEL)

        async def check(device: Device) -> tuple[int, bool]:
            async with sem:
                online = await ping_host(
                    device.iec104_host,
                    timeout_sec=settings.PING_TIMEOUT_SECONDS,
                )
            return device.id, online

        results = await asyncio.gather(*[check(d) for d in devices])

        changes = 0
        for device_id, online in results:
            prev = self._states.get(device_id)
            self._states[device_id] = online
            ts = datetime.now(timezone.utc).isoformat()

            if prev != online:
                # State transition — broadcast
                await set_device_status(device_id, online, ts)
                await bus.publish({
                    "type": "device_status",
                    "device_id": device_id,
                    "online": online,
                    "last_seen": ts,
                })
                changes += 1
                logger.info(
                    "PingMonitor device_id=%s -> %s",
                    device_id,
                    "ONLINE" if online else "OFFLINE",
                )
            elif online:
                # Stay online: just refresh last_seen
                await set_device_status(device_id, True, ts)

        online_count  = sum(1 for _, ok in results if ok)
        offline_count = len(results) - online_count
        logger.info(
            "PingMonitor cycle=%s online=%s offline=%s changes=%s",
            self._cycle, online_count, offline_count, changes,
        )


# Singleton
ping_monitor = PingMonitor()

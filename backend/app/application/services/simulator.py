"""
TelemetrySimulator — DEV-only "cold commissioning" simulyatori.

Real BMRZ qurilmalar (192.168.199.x) bu mashinadan erishib bo'lmaydi, shuning
uchun TZ "Cold commissioning: simulyatsiya" bosqichi uchun ishonchli P/Q/I/U/f
qiymatlarini generatsiya qilib, live-cache + WebSocket'ga uzatadi.

Maqsad — frontend (SubstationPage / SchemaView) va Yunusobod live-SLD
(`/api/yunusobod/sld`, `/api/yunusobod/balance`) real qurilmalarsiz ham
"tirik" ko'rinishi.

Qiymatlar DB dagi real signal_name lar ostida yoziladi (cache key:
`live:{device_id}:{signal_name}`), shu sabab yunusobod balansi (IOA→signal→
cache) va telemetry/live ularni o'qiy oladi.

Yoqish:  backend/.env da  SIMULATOR_ENABLED=true
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
from datetime import datetime, timezone

from sqlalchemy import select

from app.application.services.yunusobod_mapping import load_needed_points
from app.infrastructure.cache.redis_cache import (
    get_many_signal_values,
    publish_many_live,
    set_many_signal_values,
)
from app.infrastructure.db.database import AsyncSessionFactory
from app.infrastructure.db.models import Device, DeviceSignal, Substation
from app.infrastructure.events.bus import bus

logger = logging.getLogger(__name__)

SUBSTATION_NAME = "Yunusobod"
LOOP_SECONDS = 2.0
# Real (record_collector) qiymat shu vaqt ichida yangilangan bo'lsa — sim YOZMAYDI.
# Shu sabab simulyator faqat offline qurilmalar bo'shliqlarini to'ldiradi, real
# telemetriyani hech qachon bosib ketmaydi.
FRESH_SECONDS = 6.0

# Bazaviy quvvat (kVt): 6 ta vvod ~47 MW, 6 ta 35 kV fider ~44.8 MW (PRD demo)
P_KIRISH_BASE  = 47000.0 / 6.0
P_CHIQISH_BASE = 44800.0 / 6.0


def _octet(host: str) -> int | None:
    try:
        return int(host.strip().split(".")[-1])
    except Exception:
        return None


class TelemetrySimulator:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        # (device_id, host, [(signal_name, register_code)])
        self._devices: list[tuple[int, str, list[tuple[str, int]]]] = []
        self._ip_role: dict[str, str] = {}     # ip -> balance_rule of its P point
        self._last_loaded = 0.0
        self._walk: dict[tuple[int, int], float] = {}   # (device_id, ioa) -> value

    # ── lifecycle ──────────────────────────────────────────────────────────
    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="telemetry-sim")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("TelemetrySimulator stopped")

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    # ── config ─────────────────────────────────────────────────────────────
    async def _load(self) -> None:
        # IP -> balance role (from analitika mapping: only P points carry the rule)
        self._ip_role = {
            p.ip: p.balance_rule
            for p in load_needed_points()
            if p.point.upper() == "P" and p.ip
        }
        async with AsyncSessionFactory() as db:
            sub = (await db.execute(
                select(Substation).where(Substation.name.ilike(f"%{SUBSTATION_NAME}%"))
            )).scalars().first()
            if not sub:
                self._devices = []
                return
            devices = (await db.execute(
                select(Device).where(Device.substation_id == sub.id)
            )).scalars().all()
            sigs = (await db.execute(
                select(DeviceSignal).where(
                    DeviceSignal.device_id.in_([d.id for d in devices]),
                    (DeviceSignal.active.is_(True)) | (DeviceSignal.only_realtime.is_(True)),
                )
            )).scalars().all()
            by_dev: dict[int, list[tuple[str, int]]] = {}
            for s in sigs:
                by_dev.setdefault(s.device_id, []).append((s.signal_name, s.register_code))
            self._devices = [
                (d.id, d.iec104_host, by_dev.get(d.id, []))
                for d in devices
                if by_dev.get(d.id)
            ]

    # ── value generator (IOA + role based) ─────────────────────────────────
    def _walk_val(self, key: tuple[int, int], center: float, amp: float, lo: float, hi: float) -> float:
        cur = self._walk.get(key, center)
        cur = max(lo, min(hi, cur + random.uniform(-amp, amp)))
        self._walk[key] = cur
        return cur

    def _value(self, did: int, host: str, ioa: int) -> float:
        role = self._ip_role.get(host, "other")
        key = (did, ioa)

        if ioa == 644:  # P (kVt)
            if role == "P_kirish":
                return round(self._walk_val(key, P_KIRISH_BASE, 70, P_KIRISH_BASE*0.85, P_KIRISH_BASE*1.15), 1)
            if role == "P35_out":
                return round(self._walk_val(key, P_CHIQISH_BASE, 70, P_CHIQISH_BASE*0.85, P_CHIQISH_BASE*1.15), 1)
            return round(self._walk_val(key, 400, 25, 80, 900), 1)
        if ioa == 645:  # Q
            p = self._walk.get((did, 644), P_CHIQISH_BASE)
            return round(p * 0.32 + random.uniform(-25, 25), 1)
        if ioa == 646:  # S
            p = self._walk.get((did, 644), P_CHIQISH_BASE)
            return round(math.hypot(p, p * 0.32), 1)
        if ioa == 647:  # cos φ
            return round(self._walk_val(key, 0.95, 0.008, 0.90, 0.99), 3)
        if ioa == 648:  # frequency
            return round(self._walk_val(key, 50.0, 0.01, 49.96, 50.04), 3)
        if ioa in (641, 642, 643):  # IA / IC / IB
            p = abs(self._walk.get((did, 644), 7000))
            return round(p / 57.6 + random.uniform(-2, 2), 1)
        if ioa in (652, 653, 654):  # UAB / UBC / UCA (35 kV liniya)
            return round(self._walk_val(key, 35200, 25, 34000, 36500), 0)
        if ioa in (649, 650, 651):  # UA / UB / UC (faza)
            return round(self._walk_val(key, 20300, 15, 19500, 21000), 0)
        if 1921 <= ioa <= 1928:     # Ktr koeffitsiyentlari (const)
            return self._walk.setdefault(key, random.choice([80.0, 350.0, 1.0]))
        return round(self._walk_val(key, 25, 2, 0, 200), 2)

    # ── loop ───────────────────────────────────────────────────────────────
    async def _loop(self) -> None:
        logger.info("TelemetrySimulator started (DEV) — every %.1fs", LOOP_SECONDS)
        import time
        while not self._stop.is_set():
            try:
                now = time.monotonic()
                if now - self._last_loaded > 20:
                    await self._load()
                    self._last_loaded = now
                captured_at = datetime.now(timezone.utc)
                # Real telemetriyani bosmaslik uchun — yangi qiymatlarni o'tkazib yubor
                all_keys = [(did, nm) for did, _h, sigs in self._devices for nm, _ in sigs]
                current = await get_many_signal_values(all_keys)

                def _fresh(did: int, name: str) -> bool:
                    e = current.get((did, name))
                    if not e or not e.get("ts"):
                        return False
                    try:
                        t = datetime.fromisoformat(e["ts"])
                        return (captured_at - t).total_seconds() < FRESH_SECONDS
                    except Exception:
                        return False

                rows: list[dict] = []
                for did, host, sigs in self._devices:
                    # P (644) avval — Q/S/I uni o'qiydi
                    for name, ioa in sorted(sigs, key=lambda x: (x[1] != 644, x[1])):
                        if _fresh(did, name):
                            continue  # real qiymat bor — sim yozmaydi
                        rows.append({
                            "device_id": did, "signal_name": name,
                            "value": self._value(did, host, ioa),
                            "quality": 0, "captured_at": captured_at,
                        })
                if rows:
                    await set_many_signal_values(rows)
                    batch = [
                        {"type": "signal_update", "device_id": r["device_id"],
                         "signal_name": r["signal_name"], "value": r["value"],
                         "quality": 0, "ts": captured_at.isoformat()}
                        for r in rows
                    ]
                    await publish_many_live(batch)
                    await bus.publish({"type": "signal_batch", "items": batch})
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("TelemetrySimulator cycle failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=LOOP_SECONDS)
                return
            except asyncio.TimeoutError:
                pass


telemetry_simulator = TelemetrySimulator()

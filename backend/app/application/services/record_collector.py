from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import insert, select

from app.core.config import settings
from app.infrastructure.cache.redis_cache import (
    publish_many_live,
    set_many_signal_values,
)
# NOTE: device online/offline status is owned exclusively by PingMonitor.
# RecordCollector only persists values + broadcasts signal_update events.
from app.infrastructure.db.database import AsyncSessionFactory
from app.infrastructure.db.models import Device, DeviceSignal, Record
from app.infrastructure.events.bus import bus
from app.infrastructure.iec104 import Iec104Config, SignalValue, read_live_values

logger = logging.getLogger(__name__)
CONFIG_CACHE_SECONDS = 10.0


@dataclass(frozen=True)
class DeviceReadResult:
    device_id: int
    host: str
    port: int
    records: list[dict]
    read_count: int
    error: str | None = None


class RecordCollector:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._cycle = 0
        self._last_inserted = 0
        self._last_errors = 0
        self._config_loaded_at = 0.0
        self._cached_devices: list[Device] = []
        self._cached_by_device: dict[int, list[DeviceSignal]] = {}

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def status(self) -> dict:
        return {
            "running": self.is_running,
            "cycle": self._cycle,
            "last_inserted": self._last_inserted,
            "last_errors": self._last_errors,
        }

    def start(self) -> None:
        if self.is_running:
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run(), name="record-collector")

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
        logger.info("RecordCollector started")
        while not self._stop_event.is_set():
            started = asyncio.get_running_loop().time()
            try:
                await self.collect_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("RecordCollector cycle failed")

            elapsed = asyncio.get_running_loop().time() - started
            sleep_for = max(0.0, settings.IEC_RECORD_INTERVAL_SECONDS - elapsed)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=sleep_for)
            except asyncio.TimeoutError:
                pass

        logger.info("RecordCollector stopped")

    async def collect_once(self) -> None:
        self._cycle += 1
        devices, by_device, signal_count = await self._get_poll_config()
        async with AsyncSessionFactory() as session:
            semaphore = asyncio.Semaphore(settings.IEC_RECORD_MAX_PARALLEL_POLLS)
            results = await asyncio.gather(
                *[
                    self._read_device(device, by_device.get(device.id, []), semaphore)
                    for device in devices
                ]
            )

            rows = [
                {
                    "device_id": row["device_id"],
                    "signal_name": row["signal_name"],
                    "value": row["value"],
                    "quality": row["quality"],
                    "captured_at": row["captured_at"],
                }
                for result in results
                for row in result.records
                if row.get("persist", True)
            ]
            await self._publish_realtime(results)
            if rows:
                await session.execute(insert(Record), rows)
                await session.commit()
            else:
                await session.rollback()

            errors = [result for result in results if result.error]
            self._last_inserted = len(rows)
            self._last_errors = len(errors)

            logger.info(
                "RecordCollector cycle=%s devices=%s active_signals=%s read=%s inserted=%s errors=%s",
                self._cycle,
                len(devices),
                signal_count,
                sum(result.read_count for result in results),
                len(rows),
                len(errors),
            )
            for result in errors[:5]:
                logger.warning(
                    "RecordCollector device_id=%s %s:%s error=%s",
                    result.device_id,
                    result.host,
                    result.port,
                    result.error,
                )

    async def _get_poll_config(self) -> tuple[list[Device], dict[int, list[DeviceSignal]], int]:
        now = asyncio.get_running_loop().time()
        if self._cached_devices and now - self._config_loaded_at < CONFIG_CACHE_SECONDS:
            return (
                self._cached_devices,
                self._cached_by_device,
                sum(len(items) for items in self._cached_by_device.values()),
            )

        async with AsyncSessionFactory() as session:
            devices = (
                await session.execute(
                    select(Device).where(Device.protocol == "iec104").order_by(Device.id)
                )
            ).scalars().all()

            signals = (
                await session.execute(
                    select(DeviceSignal)
                    .where(
                        (DeviceSignal.active.is_(True))
                        | (DeviceSignal.only_realtime.is_(True))
                    )
                    .order_by(DeviceSignal.device_id, DeviceSignal.register_code)
                )
            ).scalars().all()

        by_device: dict[int, list[DeviceSignal]] = {}
        for signal in signals:
            by_device.setdefault(signal.device_id, []).append(signal)

        self._cached_devices = list(devices)
        self._cached_by_device = by_device
        self._config_loaded_at = now
        return self._cached_devices, self._cached_by_device, len(signals)

    async def _read_device(
        self,
        device: Device,
        signals: list[DeviceSignal],
        semaphore: asyncio.Semaphore,
    ) -> DeviceReadResult:
        if not signals:
            return DeviceReadResult(
                device_id=device.id,
                host=device.iec104_host,
                port=device.iec104_port,
                records=[],
                read_count=0,
            )

        wanted_ioas = {signal.register_code for signal in signals}
        captured_at = datetime.now(timezone.utc)
        cfg = Iec104Config(
            host=device.iec104_host,
            port=device.iec104_port,
            common_address=device.iec104_common_address,
            connect_timeout=settings.IEC_RECORD_CONNECT_TIMEOUT_SECONDS,
            read_timeout=settings.IEC_RECORD_READ_TIMEOUT_SECONDS,
            max_read_seconds=max(
                1.0,
                settings.IEC_RECORD_CONNECT_TIMEOUT_SECONDS
                + settings.IEC_RECORD_READ_TIMEOUT_SECONDS,
            ),
            idle_after_data_seconds=settings.IEC_RECORD_IDLE_AFTER_DATA_SECONDS,
        )

        async with semaphore:
            try:
                values = await asyncio.to_thread(read_live_values, cfg, wanted_ioas)
            except Exception as exc:
                # Don't touch device_status — that's PingMonitor's job.
                # Transient IEC-104 failures shouldn't mark device offline.
                return DeviceReadResult(
                    device_id=device.id,
                    host=device.iec104_host,
                    port=device.iec104_port,
                    records=[],
                    read_count=0,
                    error=str(exc),
                )

        return DeviceReadResult(
            device_id=device.id,
            host=device.iec104_host,
            port=device.iec104_port,
            records=self._build_records(device, signals, values, captured_at),
            read_count=len(values),
        )

    async def _publish_realtime(self, results: list[DeviceReadResult]) -> None:
        rows = [row for result in results if not result.error for row in result.records]
        await set_many_signal_values(rows)

        batch: list[dict] = []
        for result in results:
            if result.error:
                continue
            # device_status is owned by PingMonitor — don't touch it here.
            for record in result.records:
                signal_ts = record["captured_at"].isoformat()
                message = {
                    "type": "signal_update",
                    "device_id": record["device_id"],
                    "signal_name": record["signal_name"],
                    "value": record["value"],
                    "quality": record["quality"],
                    "ts": signal_ts,
                }
                batch.append(message)
        if batch:
            await publish_many_live(batch)
            await bus.publish({"type": "signal_batch", "items": batch})

    @staticmethod
    def _build_records(
        device: Device,
        signals: list[DeviceSignal],
        values: list[SignalValue],
        captured_at: datetime,
    ) -> list[dict]:
        by_ioa = {signal.register_code: signal for signal in signals}
        rows: list[dict] = []
        for value in values:
            signal = by_ioa.get(value.ioa)
            if signal is None:
                continue
            rows.append(
                {
                    "device_id": device.id,
                    "signal_name": signal.signal_name,
                    "value": float(value.value),
                    "quality": int(value.quality),
                    "captured_at": captured_at,
                    "persist": bool(signal.active),
                }
            )
        return rows


record_collector = RecordCollector()

"""
Persistent async IEC-104 session.

One long-lived TCP connection per device. Receives spontaneous data (COT=3)
in real-time and runs periodic General Interrogation for full sync.
No polling — traffic only when values actually change.
"""
from __future__ import annotations

import asyncio
import logging
import struct
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .client import (
    Iec104State,
    SignalValue,
    _parse_apdu,
    _make_gi,
    _make_s_frame,
    TYPE_SHORT,
)

logger = logging.getLogger(__name__)

# ── U-frame constants ──────────────────────────────────────────────────────
STARTDT_ACT = bytes.fromhex("68040700 0000")
STARTDT_CON = bytes.fromhex("68040B00 0000")
TESTFR_ACT  = bytes.fromhex("68044300 0000")
TESTFR_CON  = bytes.fromhex("68048300 0000")

# callback(device_id, values, is_gi_response)
OnValuesCallback = Callable[[int, list[SignalValue], bool], Coroutine[Any, Any, None]]


@dataclass
class SessionConfig:
    host: str
    port: int = 2404
    common_address: int = 3
    connect_timeout: float = 5.0
    ack_window: int = 8
    initial_gi: bool = False
    gi_interval: float = 900.0       # GI every 15 min
    reconnect_delay: float = 3.0     # initial reconnect wait
    reconnect_max: float = 60.0      # max reconnect wait
    keepalive_interval: float = 30.0  # TESTFR if idle


class Iec104Session:
    """
    Async persistent IEC-104 session for one device.

    Lifecycle:
      session.start()  → connects, sends STARTDT + GI, then listens
      session.stop()   → gracefully closes

    Data flow:
      Device sends spontaneous ASDU (COT=3) → parsed → on_values callback
      Periodic GI (every gi_interval) → full re-sync
      TESTFR keepalive if no data for keepalive_interval
    """

    def __init__(
        self,
        device_id: int,
        config: SessionConfig,
        on_values: OnValuesCallback,
    ) -> None:
        self.device_id = device_id
        self.cfg = config
        self._on_values = on_values
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._state = Iec104State()
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._last_data_at: float = 0
        self._connected = False
        self._consecutive_failures = 0

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        if self.is_running:
            return
        self._stop.clear()
        self._task = asyncio.create_task(
            self._run_forever(), name=f"iec104-{self.device_id}",
        )

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._close()

    # ── Main loop (reconnects on failure) ──────────────────────────────────

    async def _run_forever(self) -> None:
        logger.info("Session[%s] %s:%s starting", self.device_id, self.cfg.host, self.cfg.port)
        while not self._stop.is_set():
            try:
                await self._connect()
                self._consecutive_failures = 0
                await self._session_loop()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._consecutive_failures += 1
                self._connected = False
                delay = min(
                    self.cfg.reconnect_delay * (2 ** min(self._consecutive_failures - 1, 5)),
                    self.cfg.reconnect_max,
                )
                logger.warning(
                    "Session[%s] connection lost: %s — reconnect in %.0fs",
                    self.device_id, exc, delay,
                )
                await self._close()
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=delay)
                    return  # stop was requested
                except asyncio.TimeoutError:
                    pass

        logger.info("Session[%s] stopped", self.device_id)

    # ── Connect + handshake ────────────────────────────────────────────────

    async def _connect(self) -> None:
        self._state = Iec104State()
        self._reader, self._writer = await asyncio.wait_for(
            asyncio.open_connection(self.cfg.host, self.cfg.port),
            timeout=self.cfg.connect_timeout,
        )
        self._connected = True

        # STARTDT activation
        self._writer.write(STARTDT_ACT)
        await self._writer.drain()
        apdu = await self._recv_apdu()
        if apdu[2:4] != STARTDT_CON[2:4]:
            logger.debug("Session[%s] STARTDT_CON expected, got %s", self.device_id, apdu.hex())

        self._last_data_at = asyncio.get_event_loop().time()
        if self.cfg.initial_gi:
            await self._send_gi()
        logger.info("Session[%s] connected to %s:%s", self.device_id, self.cfg.host, self.cfg.port)

    # ── Session loop (read + periodic GI + keepalive) ──────────────────────

    async def _session_loop(self) -> None:
        tasks: list[asyncio.Task] = []
        if self.cfg.gi_interval > 0:
            tasks.append(asyncio.create_task(self._gi_timer()))
        if self.cfg.keepalive_interval > 0:
            tasks.append(asyncio.create_task(self._keepalive_timer()))
        try:
            await self._read_loop()
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    async def _read_loop(self) -> None:
        while not self._stop.is_set():
            apdu = await self._recv_apdu()

            # U-frame handling
            if self._is_u_frame(apdu):
                await self._handle_u_frame(apdu)
                continue

            # S-frame — just an ack, no data
            if self._is_s_frame(apdu):
                continue

            # I-frame — data
            parsed, info = _parse_apdu(apdu, self._state)

            # Ack if needed
            if self._state.unconfirmed >= self.cfg.ack_window:
                await self._send_s_frame()

            if parsed:
                self._last_data_at = asyncio.get_event_loop().time()
                # COT=20 means "interrogated by station" — GI response
                is_gi = (info or {}).get("cot") == 20
                try:
                    await self._on_values(self.device_id, parsed, is_gi)
                except Exception:
                    logger.exception("Session[%s] on_values callback error", self.device_id)

    # ── GI timer ───────────────────────────────────────────────────────────

    async def _gi_timer(self) -> None:
        if self.cfg.gi_interval <= 0:
            return
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.cfg.gi_interval)
                return
            except asyncio.TimeoutError:
                pass
            try:
                await self._send_gi()
                logger.debug("Session[%s] periodic GI sent", self.device_id)
            except Exception:
                logger.exception("Session[%s] GI send failed", self.device_id)
                return  # connection likely dead, let read_loop handle it

    # ── Keepalive (TESTFR) ─────────────────────────────────────────────────

    async def _keepalive_timer(self) -> None:
        if self.cfg.keepalive_interval <= 0:
            return
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.cfg.keepalive_interval)
                return
            except asyncio.TimeoutError:
                pass
            idle = asyncio.get_event_loop().time() - self._last_data_at
            if idle >= self.cfg.keepalive_interval:
                try:
                    await self._send_testfr()
                except Exception:
                    return

    # ── Low-level IO ───────────────────────────────────────────────────────

    async def _recv_apdu(self) -> bytes:
        assert self._reader is not None
        start = await self._reader.readexactly(1)
        if start != b"\x68":
            raise RuntimeError(f"bad IEC104 start byte: {start.hex()}")
        length_byte = await self._reader.readexactly(1)
        length = length_byte[0]
        body = await self._reader.readexactly(length)
        return start + length_byte + body

    async def _send_gi(self) -> None:
        assert self._writer is not None
        gi = _make_gi(self._state, self.cfg.common_address)
        self._writer.write(gi)
        await self._writer.drain()

    async def _send_s_frame(self) -> None:
        assert self._writer is not None
        frame = _make_s_frame(self._state.recv_seq)
        self._writer.write(frame)
        await self._writer.drain()
        self._state.unconfirmed = 0

    async def _send_testfr(self) -> None:
        assert self._writer is not None
        self._writer.write(TESTFR_ACT)
        await self._writer.drain()

    async def _handle_u_frame(self, apdu: bytes) -> None:
        ctrl = apdu[2] if len(apdu) > 2 else 0
        if ctrl == 0x43:  # TESTFR_ACT → respond with CON
            assert self._writer is not None
            self._writer.write(TESTFR_CON)
            await self._writer.drain()
            self._last_data_at = asyncio.get_event_loop().time()

    async def _close(self) -> None:
        self._connected = False
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception:
                pass
            self._writer = None
        self._reader = None

    @staticmethod
    def _is_u_frame(apdu: bytes) -> bool:
        return len(apdu) >= 4 and (apdu[2] & 0x03) == 0x03

    @staticmethod
    def _is_s_frame(apdu: bytes) -> bool:
        return len(apdu) >= 4 and (apdu[2] & 0x03) == 0x01

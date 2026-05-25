import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import asyncpg


DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/newscada"


@dataclass(frozen=True)
class Device:
    id: int
    name: str
    protocol: str
    host: str
    port: int
    common_address: int
    poll_interval_seconds: float


@dataclass(frozen=True)
class ActiveSignal:
    id: int
    device_id: int
    register_code: int
    signal_name: str
    signal_title: str | None
    unit: str
    value_type: str


def database_url() -> str:
    env_value = os.environ.get("DATABASE_URL")
    if env_value:
        return _normalize_url(env_value)

    for path in (Path("backend/.env"), Path(".env")):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return _normalize_url(line.split("=", 1)[1].strip().strip('"').strip("'"))

    return DEFAULT_DATABASE_URL


async def connect() -> asyncpg.Connection:
    return await asyncpg.connect(database_url())


async def list_devices(conn: asyncpg.Connection) -> list[Device]:
    rows = await conn.fetch(
        """
        SELECT id, name, protocol, iec104_host, iec104_port,
               iec104_common_address, poll_interval_seconds
        FROM device
        WHERE protocol = 'iec104'
        ORDER BY id
        """
    )
    return [
        Device(
            id=row["id"],
            name=row["name"],
            protocol=row["protocol"],
            host=row["iec104_host"],
            port=row["iec104_port"],
            common_address=row["iec104_common_address"],
            poll_interval_seconds=float(row["poll_interval_seconds"]),
        )
        for row in rows
    ]


async def list_active_signals(conn: asyncpg.Connection, device_id: int) -> list[ActiveSignal]:
    rows = await conn.fetch(
        """
        SELECT id, device_id, register_code, signal_name, signal_title, unit, value_type
        FROM device_signal
        WHERE device_id = $1 AND active = true
        ORDER BY register_code
        """,
        device_id,
    )
    return [
        ActiveSignal(
            id=row["id"],
            device_id=row["device_id"],
            register_code=row["register_code"],
            signal_name=row["signal_name"],
            signal_title=row["signal_title"],
            unit=row["unit"],
            value_type=row["value_type"],
        )
        for row in rows
    ]


async def list_all_active_signals(conn: asyncpg.Connection) -> dict[int, list[ActiveSignal]]:
    rows = await conn.fetch(
        """
        SELECT id, device_id, register_code, signal_name, signal_title, unit, value_type
        FROM device_signal
        WHERE active = true
        ORDER BY device_id, register_code
        """
    )
    grouped: dict[int, list[ActiveSignal]] = {}
    for row in rows:
        signal = ActiveSignal(
            id=row["id"],
            device_id=row["device_id"],
            register_code=row["register_code"],
            signal_name=row["signal_name"],
            signal_title=row["signal_title"],
            unit=row["unit"],
            value_type=row["value_type"],
        )
        grouped.setdefault(signal.device_id, []).append(signal)
    return grouped


async def insert_records(
    conn: asyncpg.Connection,
    rows: list[tuple[int, str, float, int, datetime]],
) -> None:
    if not rows:
        return
    await conn.executemany(
        """
        INSERT INTO record (device_id, signal_name, value, quality, captured_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        rows,
    )


def _normalize_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)

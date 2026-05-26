"""
Pydantic v2 request/response schemas for all API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────
#  Branch
# ──────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class BranchUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


# ──────────────────────────────────────────────
#  Substation
# ──────────────────────────────────────────────

class SubstationCreate(BaseModel):
    branch_id: int
    name: str = Field(..., min_length=1, max_length=120)


class SubstationUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class SubstationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    name: str
    created_at: datetime


# ──────────────────────────────────────────────
#  SubstationSchema
# ──────────────────────────────────────────────

class SchemaUpsert(BaseModel):
    canvas_json: dict[str, Any] = Field(default_factory=dict)


class SchemaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    substation_id: int
    canvas_json: dict[str, Any]
    updated_at: datetime


# ──────────────────────────────────────────────
#  DeviceModel (katalog)
# ──────────────────────────────────────────────

class DeviceModelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    manufacturer: str | None = Field(None, max_length=120)


class DeviceModelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    manufacturer: str | None = Field(None, max_length=120)


class DeviceModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    manufacturer: str | None
    created_at: datetime
    signal_count: int = 0


# ──────────────────────────────────────────────
#  DeviceModelSignal  (model signal kataloqi)
# ──────────────────────────────────────────────

class ModelSignalCreate(BaseModel):
    register_code: int = Field(..., ge=0)
    signal_name:   str = Field(..., min_length=1, max_length=64)
    signal_title:  str | None = Field(None, max_length=160)
    unit:          str = Field("", max_length=24)
    value_type:    str = Field("float", pattern="^(float|status|counter)$")


class ModelSignalUpdate(BaseModel):
    register_code: int | None = Field(None, ge=0)
    signal_name:   str | None = Field(None, min_length=1, max_length=64)
    signal_title:  str | None = Field(None, max_length=160)
    unit:          str | None = Field(None, max_length=24)
    value_type:    str | None = Field(None, pattern="^(float|status|counter)$")


class ModelSignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:            int
    model_id:      int
    register_code: int
    signal_name:   str
    signal_title:  str | None
    unit:          str
    value_type:    str


class ApplyResult(BaseModel):
    applied:  int   # nechta signal qo'shildi
    skipped:  int   # allaqachon mavjud (o'tkazildi)
    devices:  int   # nechta qurilmaga qo'llandi


# ──────────────────────────────────────────────
#  Device
# ──────────────────────────────────────────────

class DeviceCreate(BaseModel):
    substation_id: int
    model_id: int
    name: str = Field(..., min_length=1, max_length=120)
    protocol: str = Field("iec104", max_length=32)
    iec104_host: str = Field("127.0.0.1", max_length=64)
    iec104_port: int = Field(2404, ge=1, le=65535)
    iec104_common_address: int = Field(1, ge=1, le=65535)
    poll_interval_seconds: float = Field(1.0, ge=0.5)


class DeviceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    model_id: int | None = None
    protocol: str | None = Field(None, max_length=32)
    iec104_host: str | None = Field(None, max_length=64)
    iec104_port: int | None = Field(None, ge=1, le=65535)
    iec104_common_address: int | None = Field(None, ge=1, le=65535)
    poll_interval_seconds: float | None = Field(None, ge=0.5)


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    substation_id: int
    model_id: int
    name: str
    protocol: str
    iec104_host: str
    iec104_port: int
    iec104_common_address: int
    poll_interval_seconds: float
    created_at: datetime


class DeviceWithSignals(DeviceOut):
    signals: list["SignalOut"] = []


# ──────────────────────────────────────────────
#  DeviceSignal
# ──────────────────────────────────────────────

class SignalCreate(BaseModel):
    device_id: int
    register_code: int = Field(..., ge=0)
    signal_name: str = Field(..., min_length=1, max_length=64)
    signal_title: str | None = Field(None, max_length=160)
    unit: str = Field("", max_length=24)
    value_type: str = Field("float", pattern="^(float|status|counter)$")
    active: bool = False
    only_realtime: bool = False


class SignalUpdate(BaseModel):
    register_code: int | None = Field(None, ge=0)
    signal_name: str | None = Field(None, min_length=1, max_length=64)
    signal_title: str | None = Field(None, max_length=160)
    unit: str | None = Field(None, max_length=24)
    value_type: str | None = Field(None, pattern="^(float|status|counter)$")
    active: bool | None = None
    only_realtime: bool | None = None


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    register_code: int
    signal_name: str
    signal_title: str | None
    unit: str
    value_type: str
    active: bool
    only_realtime: bool


# ──────────────────────────────────────────────
#  Telemetry / History
# ──────────────────────────────────────────────

class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    signal_name: str
    value: float
    quality: int
    captured_at: datetime


class RangePoint(BaseModel):
    """Aggregated bucket for trading-style range queries (OHLC-like)."""
    ts:    datetime          # bucket start time
    open:  float             # first value in bucket
    high:  float             # max value in bucket
    low:   float             # min value in bucket
    close: float             # last value in bucket
    avg:   float             # average value in bucket
    count: int               # number of raw records in bucket


class LiveSignalValue(BaseModel):
    signal_name: str
    value: float | None
    quality: int
    ts: str | None


class DeviceLiveData(BaseModel):
    device_id: int
    online: bool
    last_seen: str | None
    signals: list[LiveSignalValue]


# ──────────────────────────────────────────────
#  Health
# ──────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    db: str
    redis: str
    ws_subscribers: int

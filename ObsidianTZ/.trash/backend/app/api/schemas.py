from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

BranchType = Literal["filial", "bosh_boshqarma"]
SignalValueType = Literal["float", "status"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: BranchType = "filial"


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: BranchType | None = None


class BranchRead(ORMModel):
    id: UUID
    name: str
    type: str
    created_at: datetime
    updated_at: datetime


class SubstationCreate(BaseModel):
    branch_id: UUID
    name: str = Field(min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=200)


class SubstationUpdate(BaseModel):
    branch_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=200)


class SubstationRead(ORMModel):
    id: UUID
    branch_id: UUID
    name: str
    address: str | None
    created_at: datetime
    updated_at: datetime


class DeviceModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)
    description: str | None = None


class DeviceModelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)
    description: str | None = None


class DeviceModelRead(ORMModel):
    id: UUID
    name: str
    manufacturer: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime


class DeviceCreate(BaseModel):
    substation_id: UUID
    model_id: UUID
    name: str = Field(min_length=1, max_length=120)
    protocol: str = Field(default="iec104", min_length=1, max_length=32)
    iec104_host: str = Field(default="127.0.0.1", min_length=1, max_length=64)
    iec104_port: int = Field(default=2404, ge=1, le=65535)
    iec104_common_address: int = Field(default=1, ge=1)
    poll_interval_seconds: float = Field(default=2.0, gt=0)


class DeviceUpdate(BaseModel):
    substation_id: UUID | None = None
    model_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    protocol: str | None = Field(default=None, min_length=1, max_length=32)
    iec104_host: str | None = Field(default=None, min_length=1, max_length=64)
    iec104_port: int | None = Field(default=None, ge=1, le=65535)
    iec104_common_address: int | None = Field(default=None, ge=1)
    poll_interval_seconds: float | None = Field(default=None, gt=0)


class DeviceRead(ORMModel):
    id: UUID
    substation_id: UUID
    model_id: UUID
    name: str
    protocol: str
    iec104_host: str
    iec104_port: int
    iec104_common_address: int
    poll_interval_seconds: float
    created_at: datetime
    updated_at: datetime


class DeviceSignalCreate(BaseModel):
    device_id: UUID
    register_code: int = Field(ge=0)
    signal_name: str = Field(min_length=1, max_length=64)
    signal_title: str | None = Field(default=None, max_length=160)
    unit: str = Field(default="", max_length=24)
    value_type: SignalValueType = "float"


class DeviceSignalCreateNested(BaseModel):
    register_code: int = Field(ge=0)
    signal_name: str = Field(min_length=1, max_length=64)
    signal_title: str | None = Field(default=None, max_length=160)
    unit: str = Field(default="", max_length=24)
    value_type: SignalValueType = "float"


class DeviceSignalUpdate(BaseModel):
    device_id: UUID | None = None
    register_code: int | None = Field(default=None, ge=0)
    signal_name: str | None = Field(default=None, min_length=1, max_length=64)
    signal_title: str | None = Field(default=None, max_length=160)
    unit: str | None = Field(default=None, max_length=24)
    value_type: SignalValueType | None = None


class DeviceSignalRead(ORMModel):
    id: UUID
    device_id: UUID
    register_code: int
    signal_name: str
    signal_title: str | None
    unit: str
    value_type: str
    created_at: datetime
    updated_at: datetime


class SubstationSchemaCreate(BaseModel):
    substation_id: UUID
    canvas_json: dict[str, Any] = Field(default_factory=dict)


class SubstationSchemaUpdate(BaseModel):
    substation_id: UUID | None = None
    canvas_json: dict[str, Any] | None = None


class SubstationSchemaRead(ORMModel):
    id: UUID
    substation_id: UUID
    canvas_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class RecordCreate(BaseModel):
    device_id: UUID
    signal_name: str = Field(min_length=1, max_length=64)
    value: float
    quality: int = Field(default=0, ge=0)
    captured_at: datetime


class RecordUpdate(BaseModel):
    device_id: UUID | None = None
    signal_name: str | None = Field(default=None, min_length=1, max_length=64)
    value: float | None = None
    quality: int | None = Field(default=None, ge=0)
    captured_at: datetime | None = None


class RecordRead(ORMModel):
    id: UUID
    device_id: UUID
    signal_name: str
    value: float
    quality: int
    captured_at: datetime
    created_at: datetime


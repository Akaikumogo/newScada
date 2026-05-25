from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import uuid7
from app.infrastructure.db.base import Base


class UuidPkMixin:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class BranchORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "branch"

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="filial", index=True)

    substations: Mapped[list[SubstationORM]] = relationship(back_populates="branch")


class SubstationORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "substation"

    branch_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("branch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(200))

    branch: Mapped[BranchORM] = relationship(back_populates="substations")
    devices: Mapped[list[DeviceORM]] = relationship(back_populates="substation")
    schema: Mapped[SubstationSchemaORM | None] = relationship(
        back_populates="substation",
        cascade="all, delete-orphan",
        uselist=False,
    )


class DeviceModelORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "device_model"
    __table_args__ = (UniqueConstraint("name", "manufacturer", name="uq_device_model_name_mfg"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    manufacturer: Mapped[str | None] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text)

    devices: Mapped[list[DeviceORM]] = relationship(back_populates="model")


class DeviceORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "device"

    substation_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("substation.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    model_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("device_model.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    protocol: Mapped[str] = mapped_column(String(32), nullable=False, default="iec104", index=True)
    iec104_host: Mapped[str] = mapped_column(String(64), nullable=False, default="127.0.0.1")
    iec104_port: Mapped[int] = mapped_column(Integer, nullable=False, default=2404)
    iec104_common_address: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    poll_interval_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)

    substation: Mapped[SubstationORM] = relationship(back_populates="devices")
    model: Mapped[DeviceModelORM] = relationship(back_populates="devices")
    signals: Mapped[list[DeviceSignalORM]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )
    records: Mapped[list[RecordORM]] = relationship(back_populates="device")


class DeviceSignalORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "device_signal"
    __table_args__ = (UniqueConstraint("device_id", "register_code", name="uq_signal_device_ioa"),)

    device_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("device.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    register_code: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    signal_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    signal_title: Mapped[str | None] = mapped_column(String(160), index=True)
    unit: Mapped[str] = mapped_column(String(24), nullable=False, default="", index=True)
    value_type: Mapped[str] = mapped_column(String(32), nullable=False, default="float", index=True)

    device: Mapped[DeviceORM] = relationship(back_populates="signals")


class SubstationSchemaORM(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "substation_schema"

    substation_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("substation.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    canvas_json: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
    )

    substation: Mapped[SubstationORM] = relationship(back_populates="schema")


class RecordORM(UuidPkMixin, Base):
    __tablename__ = "record"
    __table_args__ = (
        Index("idx_record_device_signal_time", "device_id", "signal_name", "captured_at"),
        Index("idx_record_captured_at", "captured_at"),
    )

    device_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("device.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    signal_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    quality: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    device: Mapped[DeviceORM] = relationship(back_populates="records")

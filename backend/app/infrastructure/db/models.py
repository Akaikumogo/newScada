from datetime import datetime
from sqlalchemy import (
    BigInteger, Float, ForeignKey, Integer, SmallInteger,
    String, Text, Boolean, DateTime, UniqueConstraint, TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.infrastructure.db.database import Base

# Timezone-aware timestamp shorthand
TZ = TIMESTAMP(timezone=True)


# ══════════════════════════════════════════════════
#  Branch
# ══════════════════════════════════════════════════
class Branch(Base):
    __tablename__ = "branch"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    name:       Mapped[str]      = mapped_column(String(120), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), nullable=False)

    substations: Mapped[list["Substation"]] = relationship(back_populates="branch", cascade="all, delete-orphan")


# ══════════════════════════════════════════════════
#  Substation
# ══════════════════════════════════════════════════
class Substation(Base):
    __tablename__ = "substation"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    branch_id:  Mapped[int]      = mapped_column(ForeignKey("branch.id", ondelete="RESTRICT"), nullable=False, index=True)
    name:       Mapped[str]      = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), nullable=False)

    branch:  Mapped["Branch"]          = relationship(back_populates="substations")
    devices: Mapped[list["Device"]]    = relationship(back_populates="substation", cascade="all, delete-orphan")
    schema:  Mapped["SubstationSchema | None"] = relationship(back_populates="substation", uselist=False, cascade="all, delete-orphan")


# ══════════════════════════════════════════════════
#  SubstationSchema  (canvas JSON)
# ══════════════════════════════════════════════════
class SubstationSchema(Base):
    __tablename__ = "substation_schema"

    id:             Mapped[int]      = mapped_column(Integer, primary_key=True)
    substation_id:  Mapped[int]      = mapped_column(ForeignKey("substation.id", ondelete="CASCADE"), nullable=False, unique=True)
    canvas_json:    Mapped[dict]     = mapped_column(JSONB, nullable=False, default={})
    updated_at:     Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now(), nullable=False)

    substation: Mapped["Substation"] = relationship(back_populates="schema")


# ══════════════════════════════════════════════════
#  DeviceModel  (katalog)
# ══════════════════════════════════════════════════
class DeviceModel(Base):
    __tablename__ = "device_model"

    id:           Mapped[int]       = mapped_column(Integer, primary_key=True)
    name:         Mapped[str]       = mapped_column(String(120), nullable=False, unique=True)
    manufacturer: Mapped[str | None]= mapped_column(String(120))
    created_at:   Mapped[datetime]  = mapped_column(TZ, server_default=func.now(), nullable=False)

    devices:        Mapped[list["Device"]]            = relationship(back_populates="model")
    model_signals:  Mapped[list["DeviceModelSignal"]]  = relationship(back_populates="model", cascade="all, delete-orphan", order_by="DeviceModelSignal.register_code")


# ══════════════════════════════════════════════════
#  DeviceModelSignal  (model signal kataloqi)
# ══════════════════════════════════════════════════
class DeviceModelSignal(Base):
    __tablename__ = "device_model_signal"
    __table_args__ = (
        UniqueConstraint("model_id", "register_code", name="uq_model_signal_ioa"),
    )

    id:            Mapped[int]        = mapped_column(Integer, primary_key=True)
    model_id:      Mapped[int]        = mapped_column(ForeignKey("device_model.id", ondelete="CASCADE"), nullable=False, index=True)
    register_code: Mapped[int]        = mapped_column(Integer, nullable=False)
    signal_name:   Mapped[str]        = mapped_column(String(64), nullable=False)
    signal_title:  Mapped[str | None] = mapped_column(String(160))
    unit:          Mapped[str]        = mapped_column(String(24), nullable=False, default="")
    value_type:    Mapped[str]        = mapped_column(String(32), nullable=False, default="float")

    model: Mapped["DeviceModel"] = relationship(back_populates="model_signals")


# ══════════════════════════════════════════════════
#  Device
# ══════════════════════════════════════════════════
class Device(Base):
    __tablename__ = "device"

    id:                    Mapped[int]   = mapped_column(Integer, primary_key=True)
    substation_id:         Mapped[int]   = mapped_column(ForeignKey("substation.id", ondelete="RESTRICT"), nullable=False, index=True)
    model_id:              Mapped[int]   = mapped_column(ForeignKey("device_model.id", ondelete="RESTRICT"), nullable=False)
    name:                  Mapped[str]   = mapped_column(String(120), nullable=False)
    protocol:              Mapped[str]   = mapped_column(String(32), nullable=False, default="iec104")
    iec104_host:           Mapped[str]   = mapped_column(String(64), nullable=False, default="127.0.0.1")
    iec104_port:           Mapped[int]   = mapped_column(Integer, nullable=False, default=2404)
    iec104_common_address: Mapped[int]   = mapped_column(Integer, nullable=False, default=1)
    poll_interval_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    created_at:            Mapped[datetime] = mapped_column(TZ, server_default=func.now(), nullable=False)

    substation: Mapped["Substation"]       = relationship(back_populates="devices")
    model:      Mapped["DeviceModel"]      = relationship(back_populates="devices")
    signals:    Mapped[list["DeviceSignal"]]= relationship(back_populates="device", cascade="all, delete-orphan")


# ══════════════════════════════════════════════════
#  DeviceSignal
# ══════════════════════════════════════════════════
class DeviceSignal(Base):
    __tablename__ = "device_signal"
    __table_args__ = (
        UniqueConstraint("device_id", "register_code", name="uq_device_ioa"),
    )

    id:             Mapped[int]       = mapped_column(Integer, primary_key=True)
    device_id:      Mapped[int]       = mapped_column(ForeignKey("device.id", ondelete="CASCADE"), nullable=False, index=True)
    register_code:  Mapped[int]       = mapped_column(Integer, nullable=False)
    signal_name:    Mapped[str]       = mapped_column(String(64), nullable=False)
    signal_title:   Mapped[str | None]= mapped_column(String(160))
    unit:           Mapped[str]       = mapped_column(String(24), nullable=False, default="")
    value_type:     Mapped[str]       = mapped_column(String(32), nullable=False, default="float")  # float | status
    active:         Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)
    only_realtime:  Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)

    device: Mapped["Device"] = relationship(back_populates="signals")


# ══════════════════════════════════════════════════
#  Record  (tarix — partitioned by captured_at)
# ══════════════════════════════════════════════════
class Record(Base):
    __tablename__ = "record"

    id:          Mapped[int]      = mapped_column(BigInteger, primary_key=True)
    device_id:   Mapped[int]      = mapped_column(Integer, nullable=False, index=True)
    signal_name: Mapped[str]      = mapped_column(String(64), nullable=False)
    value:       Mapped[float]    = mapped_column(Float, nullable=False)
    quality:     Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=0)
    captured_at: Mapped[datetime] = mapped_column(TZ, nullable=False, index=True)

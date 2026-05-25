from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select, delete, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import SignalCreate, SignalOut, SignalUpdate
from app.infrastructure.db.models import DeviceSignal

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("")
async def list_signals(
    device_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, le=500),
    db: AsyncSession = Depends(get_db),
):
    base = select(DeviceSignal)
    if device_id is not None:
        base = base.where(DeviceSignal.device_id == device_id)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    q = base.order_by(DeviceSignal.register_code).offset(skip)
    if limit > 0:
        q = q.limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total}


@router.post("", response_model=SignalOut, status_code=status.HTTP_201_CREATED)
async def create_signal(payload: SignalCreate, db: AsyncSession = Depends(get_db)):
    sig = DeviceSignal(
        device_id=payload.device_id,
        register_code=payload.register_code,
        signal_name=payload.signal_name,
        signal_title=payload.signal_title,
        unit=payload.unit,
        value_type=payload.value_type,
        active=payload.active,
        only_realtime=payload.only_realtime,
    )
    db.add(sig)
    await db.flush()
    await db.refresh(sig)
    return sig


@router.get("/{signal_id}", response_model=SignalOut)
async def get_signal(signal_id: int, db: AsyncSession = Depends(get_db)):
    sig = await db.get(DeviceSignal, signal_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    return sig


@router.put("/{signal_id}", response_model=SignalOut)
async def update_signal(
    signal_id: int, payload: SignalUpdate, db: AsyncSession = Depends(get_db)
):
    sig = await db.get(DeviceSignal, signal_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(sig, field, val)
    await db.flush()
    await db.refresh(sig)
    return sig


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal(signal_id: int, db: AsyncSession = Depends(get_db)):
    sig = await db.get(DeviceSignal, signal_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    await db.delete(sig)


@router.post("/bulk-delete")
async def bulk_delete_signals(
    ids: list[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"deleted": 0}
    result = await db.execute(delete(DeviceSignal).where(DeviceSignal.id.in_(ids)))
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/delete-all")
async def delete_all_signals(
    device_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(delete(DeviceSignal).where(DeviceSignal.device_id == device_id))
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/bulk-set-active")
async def bulk_set_active(
    ids: list[int] = Body(..., embed=True),
    active: bool = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"updated": 0}
    values: dict = {"active": active}
    if active:
        values["only_realtime"] = False
    result = await db.execute(
        update(DeviceSignal).where(DeviceSignal.id.in_(ids)).values(**values)
    )
    await db.flush()
    return {"updated": result.rowcount}


@router.post("/set-active-all")
async def set_active_all(
    device_id: int = Body(..., embed=True),
    active: bool = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    values: dict = {"active": active}
    if active:
        values["only_realtime"] = False
    result = await db.execute(
        update(DeviceSignal).where(DeviceSignal.device_id == device_id).values(**values)
    )
    await db.flush()
    return {"updated": result.rowcount}

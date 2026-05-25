from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_db
from app.api.schemas import (
    DeviceModelCreate, DeviceModelOut, DeviceModelUpdate,
    ModelSignalCreate, ModelSignalUpdate, ModelSignalOut, ApplyResult,
)
from app.infrastructure.db.models import DeviceModel, DeviceModelSignal, Device, DeviceSignal

router = APIRouter(prefix="/device-models", tags=["device-models"])


# ── DeviceModel CRUD ─────────────────────────────

@router.get("")
async def list_models(
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, le=500),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count()).select_from(DeviceModel))
    q = (
        select(DeviceModel)
        .options(selectinload(DeviceModel.model_signals))
        .order_by(DeviceModel.name)
        .offset(skip)
    )
    if limit > 0:
        q = q.limit(limit)
    result = await db.execute(q)
    models = result.scalars().all()
    items = []
    for m in models:
        d = DeviceModelOut.model_validate(m)
        d.signal_count = len(m.model_signals)
        items.append(d)
    return {"items": items, "total": total}


@router.post("", response_model=DeviceModelOut, status_code=status.HTTP_201_CREATED)
async def create_model(payload: DeviceModelCreate, db: AsyncSession = Depends(get_db)):
    m = DeviceModel(name=payload.name, manufacturer=payload.manufacturer)
    db.add(m)
    await db.flush()
    await db.refresh(m)
    d = DeviceModelOut.model_validate(m)
    d.signal_count = 0
    return d


@router.get("/{model_id}", response_model=DeviceModelOut)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DeviceModel)
        .options(selectinload(DeviceModel.model_signals))
        .where(DeviceModel.id == model_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="DeviceModel topilmadi")
    d = DeviceModelOut.model_validate(m)
    d.signal_count = len(m.model_signals)
    return d


@router.put("/{model_id}", response_model=DeviceModelOut)
async def update_model(
    model_id: int, payload: DeviceModelUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DeviceModel)
        .options(selectinload(DeviceModel.model_signals))
        .where(DeviceModel.id == model_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="DeviceModel topilmadi")
    if payload.name is not None:
        m.name = payload.name
    if payload.manufacturer is not None:
        m.manufacturer = payload.manufacturer
    await db.flush()
    await db.refresh(m)
    d = DeviceModelOut.model_validate(m)
    d.signal_count = len(m.model_signals)
    return d


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(model_id: int, db: AsyncSession = Depends(get_db)):
    m = await db.get(DeviceModel, model_id)
    if not m:
        raise HTTPException(status_code=404, detail="DeviceModel topilmadi")
    await db.delete(m)


@router.post("/bulk-delete")
async def bulk_delete_models(
    ids: list[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"deleted": 0}
    result = await db.execute(delete(DeviceModel).where(DeviceModel.id.in_(ids)))
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/delete-all")
async def delete_all_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(DeviceModel))
    await db.flush()
    return {"deleted": result.rowcount}


# ── Model Signal Kataloqi CRUD ────────────────────

@router.get("/{model_id}/signals")
async def list_model_signals(
    model_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, le=500),
    db: AsyncSession = Depends(get_db),
):
    base = select(DeviceModelSignal).where(DeviceModelSignal.model_id == model_id)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    q = base.order_by(DeviceModelSignal.register_code).offset(skip)
    if limit > 0:
        q = q.limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total}


@router.post("/{model_id}/signals/bulk", response_model=ApplyResult, status_code=status.HTTP_201_CREATED)
async def bulk_import_signals(
    model_id: int,
    signals: list[ModelSignalCreate],
    db: AsyncSession = Depends(get_db),
):
    """
    Bir vaqtda ko'p signal qo'shish (import).
    Mavjud IOAlar o'tkazib yuboriladi (duplicate xato bermaydi).
    """
    m = await db.get(DeviceModel, model_id)
    if not m:
        raise HTTPException(status_code=404, detail="DeviceModel topilmadi")

    existing = await db.execute(
        select(DeviceModelSignal.register_code).where(DeviceModelSignal.model_id == model_id)
    )
    existing_ioas = {row[0] for row in existing.all()}

    applied = 0
    skipped = 0
    for s in signals:
        if s.register_code in existing_ioas:
            skipped += 1
            continue
        db.add(DeviceModelSignal(
            model_id      = model_id,
            register_code = s.register_code,
            signal_name   = s.signal_name,
            signal_title  = s.signal_title,
            unit          = s.unit,
            value_type    = s.value_type,
        ))
        existing_ioas.add(s.register_code)
        applied += 1

    await db.flush()
    return ApplyResult(applied=applied, skipped=skipped, devices=0)


@router.post("/{model_id}/signals", response_model=ModelSignalOut, status_code=status.HTTP_201_CREATED)
async def create_model_signal(
    model_id: int, payload: ModelSignalCreate, db: AsyncSession = Depends(get_db)
):
    m = await db.get(DeviceModel, model_id)
    if not m:
        raise HTTPException(status_code=404, detail="DeviceModel topilmadi")
    sig = DeviceModelSignal(
        model_id      = model_id,
        register_code = payload.register_code,
        signal_name   = payload.signal_name,
        signal_title  = payload.signal_title,
        unit          = payload.unit,
        value_type    = payload.value_type,
    )
    db.add(sig)
    await db.flush()
    await db.refresh(sig)
    return sig


@router.put("/{model_id}/signals/{sig_id}", response_model=ModelSignalOut)
async def update_model_signal(
    model_id: int, sig_id: int, payload: ModelSignalUpdate,
    db: AsyncSession = Depends(get_db)
):
    sig = await db.get(DeviceModelSignal, sig_id)
    if not sig or sig.model_id != model_id:
        raise HTTPException(status_code=404, detail="Signal topilmadi")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(sig, field, value)
    await db.flush()
    await db.refresh(sig)
    return sig


@router.delete("/{model_id}/signals/{sig_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_signal(
    model_id: int, sig_id: int, db: AsyncSession = Depends(get_db)
):
    sig = await db.get(DeviceModelSignal, sig_id)
    if not sig or sig.model_id != model_id:
        raise HTTPException(status_code=404, detail="Signal topilmadi")
    await db.delete(sig)


@router.post("/{model_id}/signals/bulk-delete")
async def bulk_delete_model_signals(
    model_id: int,
    ids: list[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"deleted": 0}
    result = await db.execute(
        delete(DeviceModelSignal).where(
            DeviceModelSignal.id.in_(ids),
            DeviceModelSignal.model_id == model_id,
        )
    )
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/{model_id}/signals/delete-all")
async def delete_all_model_signals(
    model_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(DeviceModelSignal).where(DeviceModelSignal.model_id == model_id)
    )
    await db.flush()
    return {"deleted": result.rowcount}


# ── Katalogni qurilmalarga qo'llash ──────────────

@router.post("/{model_id}/apply/{device_id}", response_model=ApplyResult)
async def apply_to_device(
    model_id: int, device_id: int, db: AsyncSession = Depends(get_db)
):
    """Model signal katalogini bitta qurilmaga nusxalaydi."""
    return await _apply_catalog(db, model_id, [device_id])


@router.post("/{model_id}/apply-all", response_model=ApplyResult)
async def apply_to_all_devices(
    model_id: int, db: AsyncSession = Depends(get_db)
):
    """Model signal katalogini shu modelga ega barcha qurilmalarga nusxalaydi."""
    result = await db.execute(
        select(Device.id).where(Device.model_id == model_id)
    )
    device_ids = [row[0] for row in result.all()]
    if not device_ids:
        return ApplyResult(applied=0, skipped=0, devices=0)
    return await _apply_catalog(db, model_id, device_ids)


async def _apply_catalog(
    db: AsyncSession, model_id: int, device_ids: list[int]
) -> ApplyResult:
    """Katalog signallarini device_ids larga nusxalash (mavjudlarini o'tkazib yuborish)."""
    # Katalog signallarini olish
    cat_result = await db.execute(
        select(DeviceModelSignal).where(DeviceModelSignal.model_id == model_id)
    )
    catalog = cat_result.scalars().all()
    if not catalog:
        return ApplyResult(applied=0, skipped=0, devices=len(device_ids))

    applied = 0
    skipped = 0

    for dev_id in device_ids:
        # Qurilmaning mavjud IOAlarini olish
        existing = await db.execute(
            select(DeviceSignal.register_code).where(DeviceSignal.device_id == dev_id)
        )
        existing_ioas = {row[0] for row in existing.all()}

        for cat_sig in catalog:
            if cat_sig.register_code in existing_ioas:
                skipped += 1
                continue
            db.add(DeviceSignal(
                device_id     = dev_id,
                register_code = cat_sig.register_code,
                signal_name   = cat_sig.signal_name,
                signal_title  = cat_sig.signal_title,
                unit          = cat_sig.unit,
                value_type    = cat_sig.value_type,
            ))
            applied += 1

    await db.flush()
    return ApplyResult(applied=applied, skipped=skipped, devices=len(device_ids))

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import (
    DeviceSignalCreate,
    DeviceSignalCreateNested,
    DeviceSignalRead,
    DeviceSignalUpdate,
)
from app.infrastructure.db.models import DeviceORM, DeviceSignalORM

router = APIRouter(tags=["signals"])

SORT_COLUMNS = {
    "id": DeviceSignalORM.id,
    "register_code": DeviceSignalORM.register_code,
    "signal_name": DeviceSignalORM.signal_name,
    "unit": DeviceSignalORM.unit,
    "value_type": DeviceSignalORM.value_type,
    "created_at": DeviceSignalORM.created_at,
    "updated_at": DeviceSignalORM.updated_at,
}


@router.get("/signals", response_model=Page[DeviceSignalRead])
async def list_signals(
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    device_id: UUID | None = Query(default=None),
    register_code: int | None = Query(default=None, ge=0),
    value_type: str | None = Query(default=None),
    unit: str | None = Query(default=None),
    sort_by: str | None = Query(default="created_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[DeviceSignalRead]:
    stmt = select(DeviceSignalORM)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                DeviceSignalORM.signal_name.ilike(pattern),
                DeviceSignalORM.signal_title.ilike(pattern),
                DeviceSignalORM.unit.ilike(pattern),
            )
        )
    if device_id:
        stmt = stmt.where(DeviceSignalORM.device_id == device_id)
    if register_code is not None:
        stmt = stmt.where(DeviceSignalORM.register_code == register_code)
    if value_type:
        stmt = stmt.where(DeviceSignalORM.value_type == value_type)
    if unit:
        stmt = stmt.where(DeviceSignalORM.unit == unit)
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS)
    items, meta = await paginate(session, stmt, params)
    return Page[DeviceSignalRead](items=items, meta=meta)


@router.get("/signals/{signal_id}", response_model=DeviceSignalRead)
async def get_signal(
    signal_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> DeviceSignalORM:
    return await get_or_404(session, DeviceSignalORM, signal_id, "Signal")


@router.post("/signals", response_model=DeviceSignalRead, status_code=status.HTTP_201_CREATED)
async def create_signal(
    payload: DeviceSignalCreate,
    session: AsyncSession = Depends(get_session),
) -> DeviceSignalORM:
    await get_or_404(session, DeviceORM, payload.device_id, "Device")
    signal = DeviceSignalORM(**payload.model_dump())
    session.add(signal)
    await session.commit()
    await session.refresh(signal)
    return signal


@router.post(
    "/devices/{device_id}/signals",
    response_model=DeviceSignalRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_device_signal(
    device_id: UUID,
    payload: DeviceSignalCreateNested,
    session: AsyncSession = Depends(get_session),
) -> DeviceSignalORM:
    await get_or_404(session, DeviceORM, device_id, "Device")
    signal = DeviceSignalORM(device_id=device_id, **payload.model_dump())
    session.add(signal)
    await session.commit()
    await session.refresh(signal)
    return signal


@router.get("/devices/{device_id}/signals", response_model=Page[DeviceSignalRead])
async def list_device_signals(
    device_id: UUID,
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    sort_by: str | None = Query(default="register_code"),
    sort_order: SortOrder = Query(default="asc"),
    session: AsyncSession = Depends(get_session),
) -> Page[DeviceSignalRead]:
    await get_or_404(session, DeviceORM, device_id, "Device")
    stmt = select(DeviceSignalORM).where(DeviceSignalORM.device_id == device_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                DeviceSignalORM.signal_name.ilike(pattern),
                DeviceSignalORM.signal_title.ilike(pattern),
            )
        )
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS, default_sort="register_code")
    items, meta = await paginate(session, stmt, params)
    return Page[DeviceSignalRead](items=items, meta=meta)


@router.patch("/signals/{signal_id}", response_model=DeviceSignalRead)
async def update_signal(
    signal_id: UUID,
    payload: DeviceSignalUpdate,
    session: AsyncSession = Depends(get_session),
) -> DeviceSignalORM:
    signal = await get_or_404(session, DeviceSignalORM, signal_id, "Signal")
    if payload.device_id is not None:
        await get_or_404(session, DeviceORM, payload.device_id, "Device")
    apply_update(signal, payload)
    await session.commit()
    await session.refresh(signal)
    return signal


@router.delete("/signals/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal(signal_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    signal = await get_or_404(session, DeviceSignalORM, signal_id, "Signal")
    await session.delete(signal)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

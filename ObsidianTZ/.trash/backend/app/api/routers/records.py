from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import RecordCreate, RecordRead, RecordUpdate
from app.infrastructure.db.models import DeviceORM, RecordORM

router = APIRouter(prefix="/records", tags=["records"])

SORT_COLUMNS = {
    "id": RecordORM.id,
    "signal_name": RecordORM.signal_name,
    "value": RecordORM.value,
    "quality": RecordORM.quality,
    "captured_at": RecordORM.captured_at,
    "created_at": RecordORM.created_at,
}


@router.get("", response_model=Page[RecordRead])
async def list_records(
    params: PageParams = Depends(get_page_params),
    device_id: UUID | None = Query(default=None),
    signal_name: str | None = Query(default=None, min_length=1),
    search: str | None = Query(default=None, min_length=1),
    captured_from: datetime | None = Query(default=None, alias="from"),
    captured_to: datetime | None = Query(default=None, alias="to"),
    quality: int | None = Query(default=None, ge=0),
    sort_by: str | None = Query(default="captured_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[RecordRead]:
    stmt = select(RecordORM)
    if device_id:
        stmt = stmt.where(RecordORM.device_id == device_id)
    if signal_name:
        stmt = stmt.where(RecordORM.signal_name == signal_name)
    if search:
        stmt = stmt.where(RecordORM.signal_name.ilike(f"%{search}%"))
    if captured_from:
        stmt = stmt.where(RecordORM.captured_at >= captured_from)
    if captured_to:
        stmt = stmt.where(RecordORM.captured_at <= captured_to)
    if quality is not None:
        stmt = stmt.where(RecordORM.quality == quality)
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS, default_sort="captured_at")
    items, meta = await paginate(session, stmt, params)
    return Page[RecordRead](items=items, meta=meta)


@router.get("/{record_id}", response_model=RecordRead)
async def get_record(record_id: UUID, session: AsyncSession = Depends(get_session)) -> RecordORM:
    return await get_or_404(session, RecordORM, record_id, "Record")


@router.post("", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
async def create_record(
    payload: RecordCreate,
    session: AsyncSession = Depends(get_session),
) -> RecordORM:
    await get_or_404(session, DeviceORM, payload.device_id, "Device")
    record = RecordORM(**payload.model_dump())
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


@router.patch("/{record_id}", response_model=RecordRead)
async def update_record(
    record_id: UUID,
    payload: RecordUpdate,
    session: AsyncSession = Depends(get_session),
) -> RecordORM:
    record = await get_or_404(session, RecordORM, record_id, "Record")
    if payload.device_id is not None:
        await get_or_404(session, DeviceORM, payload.device_id, "Device")
    apply_update(record, payload)
    await session.commit()
    await session.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(record_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    record = await get_or_404(session, RecordORM, record_id, "Record")
    await session.delete(record)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

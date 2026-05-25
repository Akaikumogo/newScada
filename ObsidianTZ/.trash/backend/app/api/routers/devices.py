from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import DeviceCreate, DeviceRead, DeviceUpdate
from app.infrastructure.db.models import DeviceModelORM, DeviceORM, SubstationORM

router = APIRouter(prefix="/devices", tags=["devices"])

SORT_COLUMNS = {
    "id": DeviceORM.id,
    "name": DeviceORM.name,
    "protocol": DeviceORM.protocol,
    "iec104_host": DeviceORM.iec104_host,
    "iec104_port": DeviceORM.iec104_port,
    "created_at": DeviceORM.created_at,
    "updated_at": DeviceORM.updated_at,
}


@router.get("", response_model=Page[DeviceRead])
async def list_devices(
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    substation_id: UUID | None = Query(default=None),
    model_id: UUID | None = Query(default=None),
    protocol: str | None = Query(default=None, min_length=1),
    host: str | None = Query(default=None, min_length=1),
    sort_by: str | None = Query(default="created_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[DeviceRead]:
    stmt = select(DeviceORM)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(DeviceORM.name.ilike(pattern), DeviceORM.iec104_host.ilike(pattern)))
    if substation_id:
        stmt = stmt.where(DeviceORM.substation_id == substation_id)
    if model_id:
        stmt = stmt.where(DeviceORM.model_id == model_id)
    if protocol:
        stmt = stmt.where(DeviceORM.protocol == protocol)
    if host:
        stmt = stmt.where(DeviceORM.iec104_host.ilike(f"%{host}%"))
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS)
    items, meta = await paginate(session, stmt, params)
    return Page[DeviceRead](items=items, meta=meta)


@router.get("/{device_id}", response_model=DeviceRead)
async def get_device(device_id: UUID, session: AsyncSession = Depends(get_session)) -> DeviceORM:
    return await get_or_404(session, DeviceORM, device_id, "Device")


@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    session: AsyncSession = Depends(get_session),
) -> DeviceORM:
    await get_or_404(session, SubstationORM, payload.substation_id, "Substation")
    await get_or_404(session, DeviceModelORM, payload.model_id, "Device model")
    device = DeviceORM(**payload.model_dump())
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return device


@router.patch("/{device_id}", response_model=DeviceRead)
async def update_device(
    device_id: UUID,
    payload: DeviceUpdate,
    session: AsyncSession = Depends(get_session),
) -> DeviceORM:
    device = await get_or_404(session, DeviceORM, device_id, "Device")
    if payload.substation_id is not None:
        await get_or_404(session, SubstationORM, payload.substation_id, "Substation")
    if payload.model_id is not None:
        await get_or_404(session, DeviceModelORM, payload.model_id, "Device model")
    apply_update(device, payload)
    await session.commit()
    await session.refresh(device)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(device_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    device = await get_or_404(session, DeviceORM, device_id, "Device")
    await session.delete(device)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

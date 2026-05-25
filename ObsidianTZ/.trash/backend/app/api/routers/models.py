from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import DeviceModelCreate, DeviceModelRead, DeviceModelUpdate
from app.infrastructure.db.models import DeviceModelORM

router = APIRouter(prefix="/models", tags=["device-models"])

SORT_COLUMNS = {
    "id": DeviceModelORM.id,
    "name": DeviceModelORM.name,
    "manufacturer": DeviceModelORM.manufacturer,
    "created_at": DeviceModelORM.created_at,
    "updated_at": DeviceModelORM.updated_at,
}


@router.get("", response_model=Page[DeviceModelRead])
async def list_models(
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    manufacturer: str | None = Query(default=None, min_length=1),
    sort_by: str | None = Query(default="created_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[DeviceModelRead]:
    stmt = select(DeviceModelORM)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                DeviceModelORM.name.ilike(pattern),
                DeviceModelORM.manufacturer.ilike(pattern),
                DeviceModelORM.description.ilike(pattern),
            )
        )
    if manufacturer:
        stmt = stmt.where(DeviceModelORM.manufacturer.ilike(f"%{manufacturer}%"))
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS)
    items, meta = await paginate(session, stmt, params)
    return Page[DeviceModelRead](items=items, meta=meta)


@router.get("/{model_id}", response_model=DeviceModelRead)
async def get_model(model_id: UUID, session: AsyncSession = Depends(get_session)) -> DeviceModelORM:
    return await get_or_404(session, DeviceModelORM, model_id, "Device model")


@router.post("", response_model=DeviceModelRead, status_code=status.HTTP_201_CREATED)
async def create_model(
    payload: DeviceModelCreate,
    session: AsyncSession = Depends(get_session),
) -> DeviceModelORM:
    model = DeviceModelORM(**payload.model_dump())
    session.add(model)
    await session.commit()
    await session.refresh(model)
    return model


@router.patch("/{model_id}", response_model=DeviceModelRead)
async def update_model(
    model_id: UUID,
    payload: DeviceModelUpdate,
    session: AsyncSession = Depends(get_session),
) -> DeviceModelORM:
    model = await get_or_404(session, DeviceModelORM, model_id, "Device model")
    apply_update(model, payload)
    await session.commit()
    await session.refresh(model)
    return model


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(model_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    model = await get_or_404(session, DeviceModelORM, model_id, "Device model")
    await session.delete(model)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


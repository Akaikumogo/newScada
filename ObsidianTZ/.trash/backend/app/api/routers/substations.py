from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import SubstationCreate, SubstationRead, SubstationUpdate
from app.infrastructure.db.models import BranchORM, SubstationORM

router = APIRouter(prefix="/substations", tags=["substations"])

SORT_COLUMNS = {
    "id": SubstationORM.id,
    "name": SubstationORM.name,
    "address": SubstationORM.address,
    "created_at": SubstationORM.created_at,
    "updated_at": SubstationORM.updated_at,
}


@router.get("", response_model=Page[SubstationRead])
async def list_substations(
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    branch_id: UUID | None = Query(default=None),
    sort_by: str | None = Query(default="created_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[SubstationRead]:
    stmt = select(SubstationORM)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                SubstationORM.name.ilike(pattern),
                SubstationORM.address.ilike(pattern),
            )
        )
    if branch_id:
        stmt = stmt.where(SubstationORM.branch_id == branch_id)
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS)
    items, meta = await paginate(session, stmt, params)
    return Page[SubstationRead](items=items, meta=meta)


@router.get("/{substation_id}", response_model=SubstationRead)
async def get_substation(
    substation_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> SubstationORM:
    return await get_or_404(session, SubstationORM, substation_id, "Substation")


@router.post("", response_model=SubstationRead, status_code=status.HTTP_201_CREATED)
async def create_substation(
    payload: SubstationCreate,
    session: AsyncSession = Depends(get_session),
) -> SubstationORM:
    await get_or_404(session, BranchORM, payload.branch_id, "Branch")
    substation = SubstationORM(**payload.model_dump())
    session.add(substation)
    await session.commit()
    await session.refresh(substation)
    return substation


@router.patch("/{substation_id}", response_model=SubstationRead)
async def update_substation(
    substation_id: UUID,
    payload: SubstationUpdate,
    session: AsyncSession = Depends(get_session),
) -> SubstationORM:
    substation = await get_or_404(session, SubstationORM, substation_id, "Substation")
    if payload.branch_id is not None:
        await get_or_404(session, BranchORM, payload.branch_id, "Branch")
    apply_update(substation, payload)
    await session.commit()
    await session.refresh(substation)
    return substation


@router.delete("/{substation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_substation(
    substation_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Response:
    substation = await get_or_404(session, SubstationORM, substation_id, "Substation")
    await session.delete(substation)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

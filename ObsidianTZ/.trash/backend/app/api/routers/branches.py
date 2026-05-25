from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import BranchCreate, BranchRead, BranchUpdate
from app.infrastructure.db.models import BranchORM

router = APIRouter(prefix="/branches", tags=["branches"])

SORT_COLUMNS = {
    "id": BranchORM.id,
    "name": BranchORM.name,
    "type": BranchORM.type,
    "created_at": BranchORM.created_at,
    "updated_at": BranchORM.updated_at,
}


@router.get("", response_model=Page[BranchRead])
async def list_branches(
    params: PageParams = Depends(get_page_params),
    search: str | None = Query(default=None, min_length=1),
    type: str | None = Query(default=None),
    sort_by: str | None = Query(default="created_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[BranchRead]:
    stmt = select(BranchORM)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(BranchORM.name.ilike(pattern), BranchORM.type.ilike(pattern)))
    if type:
        stmt = stmt.where(BranchORM.type == type)
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS)
    items, meta = await paginate(session, stmt, params)
    return Page[BranchRead](items=items, meta=meta)


@router.get("/{branch_id}", response_model=BranchRead)
async def get_branch(branch_id: UUID, session: AsyncSession = Depends(get_session)) -> BranchORM:
    return await get_or_404(session, BranchORM, branch_id, "Branch")


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    session: AsyncSession = Depends(get_session),
) -> BranchORM:
    branch = BranchORM(**payload.model_dump())
    session.add(branch)
    await session.commit()
    await session.refresh(branch)
    return branch


@router.patch("/{branch_id}", response_model=BranchRead)
async def update_branch(
    branch_id: UUID,
    payload: BranchUpdate,
    session: AsyncSession = Depends(get_session),
) -> BranchORM:
    branch = await get_or_404(session, BranchORM, branch_id, "Branch")
    apply_update(branch, payload)
    await session.commit()
    await session.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(branch_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    branch = await get_or_404(session, BranchORM, branch_id, "Branch")
    await session.delete(branch)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

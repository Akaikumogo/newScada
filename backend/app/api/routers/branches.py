from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import BranchCreate, BranchOut, BranchUpdate
from app.infrastructure.db.models import Branch

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("")
async def list_branches(
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, le=500),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count()).select_from(Branch))
    q = select(Branch).order_by(Branch.id).offset(skip)
    if limit > 0:
        q = q.limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": items, "total": total}


@router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(payload: BranchCreate, db: AsyncSession = Depends(get_db)):
    branch = Branch(name=payload.name)
    db.add(branch)
    await db.flush()
    await db.refresh(branch)
    return branch


@router.get("/{branch_id}", response_model=BranchOut)
async def get_branch(branch_id: int, db: AsyncSession = Depends(get_db)):
    branch = await db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.put("/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: int, payload: BranchUpdate, db: AsyncSession = Depends(get_db)
):
    branch = await db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.name = payload.name
    await db.flush()
    await db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(branch_id: int, db: AsyncSession = Depends(get_db)):
    branch = await db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    await db.delete(branch)


@router.post("/bulk-delete")
async def bulk_delete_branches(
    ids: list[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"deleted": 0}
    result = await db.execute(delete(Branch).where(Branch.id.in_(ids)))
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/delete-all")
async def delete_all_branches(db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Branch))
    await db.flush()
    return {"deleted": result.rowcount}

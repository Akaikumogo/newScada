from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.api.schemas import (
    SubstationCreate, SubstationOut, SubstationUpdate,
    SchemaUpsert, SchemaOut,
)
from app.infrastructure.db.models import Substation, SubstationSchema

router = APIRouter(prefix="/substations", tags=["substations"])


@router.get("")
async def list_substations(
    branch_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, le=500),
    db: AsyncSession = Depends(get_db),
):
    base_filter = []
    if branch_id is not None:
        base_filter.append(Substation.branch_id == branch_id)

    # Count total
    count_q = select(func.count()).select_from(Substation)
    if base_filter:
        count_q = count_q.where(*base_filter)
    total = await db.scalar(count_q)

    # Fetch items
    q = select(Substation).order_by(Substation.id).offset(skip)
    if base_filter:
        q = q.where(*base_filter)
    if limit > 0:
        q = q.limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total}


@router.post("", response_model=SubstationOut, status_code=status.HTTP_201_CREATED)
async def create_substation(
    payload: SubstationCreate, db: AsyncSession = Depends(get_db)
):
    sub = Substation(branch_id=payload.branch_id, name=payload.name)
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@router.get("/{sub_id}", response_model=SubstationOut)
async def get_substation(sub_id: int, db: AsyncSession = Depends(get_db)):
    sub = await db.get(Substation, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Substation not found")
    return sub


@router.put("/{sub_id}", response_model=SubstationOut)
async def update_substation(
    sub_id: int, payload: SubstationUpdate, db: AsyncSession = Depends(get_db)
):
    sub = await db.get(Substation, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Substation not found")
    sub.name = payload.name
    await db.flush()
    await db.refresh(sub)
    return sub


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_substation(sub_id: int, db: AsyncSession = Depends(get_db)):
    sub = await db.get(Substation, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Substation not found")
    await db.delete(sub)


@router.post("/bulk-delete")
async def bulk_delete_substations(
    ids: list[int] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return {"deleted": 0}
    result = await db.execute(delete(Substation).where(Substation.id.in_(ids)))
    await db.flush()
    return {"deleted": result.rowcount}


@router.post("/delete-all")
async def delete_all_substations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Substation))
    await db.flush()
    return {"deleted": result.rowcount}


# ─── Schema (canvas JSON) ────────────────────────────────────────────────────

@router.get("/{sub_id}/schema", response_model=SchemaOut | None)
async def get_schema(sub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SubstationSchema).where(SubstationSchema.substation_id == sub_id)
    )
    return result.scalar_one_or_none()


@router.put("/{sub_id}/schema", response_model=SchemaOut)
async def upsert_schema(
    sub_id: int, payload: SchemaUpsert, db: AsyncSession = Depends(get_db)
):
    # verify substation exists
    sub = await db.get(Substation, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Substation not found")

    result = await db.execute(
        select(SubstationSchema).where(SubstationSchema.substation_id == sub_id)
    )
    schema = result.scalar_one_or_none()
    if schema is None:
        schema = SubstationSchema(substation_id=sub_id, canvas_json=payload.canvas_json)
        db.add(schema)
    else:
        schema.canvas_json = payload.canvas_json
    await db.flush()
    await db.refresh(schema)
    return schema

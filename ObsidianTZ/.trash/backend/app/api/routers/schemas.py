from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import apply_update, get_or_404
from app.api.dependencies import get_session
from app.api.pagination import Page, PageParams, SortOrder, apply_sort, get_page_params, paginate
from app.api.schemas import (
    SubstationSchemaCreate,
    SubstationSchemaRead,
    SubstationSchemaUpdate,
)
from app.infrastructure.db.models import SubstationORM, SubstationSchemaORM

router = APIRouter(tags=["schemas"])

SORT_COLUMNS = {
    "id": SubstationSchemaORM.id,
    "substation_id": SubstationSchemaORM.substation_id,
    "created_at": SubstationSchemaORM.created_at,
    "updated_at": SubstationSchemaORM.updated_at,
}


@router.get("/schemas", response_model=Page[SubstationSchemaRead])
async def list_schemas(
    params: PageParams = Depends(get_page_params),
    substation_id: UUID | None = Query(default=None),
    sort_by: str | None = Query(default="updated_at"),
    sort_order: SortOrder = Query(default="desc"),
    session: AsyncSession = Depends(get_session),
) -> Page[SubstationSchemaRead]:
    stmt = select(SubstationSchemaORM)
    if substation_id:
        stmt = stmt.where(SubstationSchemaORM.substation_id == substation_id)
    stmt = apply_sort(stmt, sort_by, sort_order, SORT_COLUMNS, default_sort="updated_at")
    items, meta = await paginate(session, stmt, params)
    return Page[SubstationSchemaRead](items=items, meta=meta)


@router.get("/schemas/{schema_id}", response_model=SubstationSchemaRead)
async def get_schema(
    schema_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> SubstationSchemaORM:
    return await get_or_404(session, SubstationSchemaORM, schema_id, "Schema")


@router.get("/substations/{substation_id}/schema", response_model=SubstationSchemaRead | None)
async def get_substation_schema(
    substation_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> SubstationSchemaORM | None:
    await get_or_404(session, SubstationORM, substation_id, "Substation")
    result = await session.execute(
        select(SubstationSchemaORM).where(SubstationSchemaORM.substation_id == substation_id)
    )
    return result.scalar_one_or_none()


@router.post("/schemas", response_model=SubstationSchemaRead, status_code=status.HTTP_201_CREATED)
async def create_schema(
    payload: SubstationSchemaCreate,
    session: AsyncSession = Depends(get_session),
) -> SubstationSchemaORM:
    await get_or_404(session, SubstationORM, payload.substation_id, "Substation")
    schema = SubstationSchemaORM(**payload.model_dump())
    session.add(schema)
    await session.commit()
    await session.refresh(schema)
    return schema


@router.put("/substations/{substation_id}/schema", response_model=SubstationSchemaRead)
async def upsert_substation_schema(
    substation_id: UUID,
    payload: SubstationSchemaUpdate,
    session: AsyncSession = Depends(get_session),
) -> SubstationSchemaORM:
    await get_or_404(session, SubstationORM, substation_id, "Substation")
    result = await session.execute(
        select(SubstationSchemaORM).where(SubstationSchemaORM.substation_id == substation_id)
    )
    schema = result.scalar_one_or_none()
    canvas_json = payload.canvas_json if payload.canvas_json is not None else {}
    if schema is None:
        schema = SubstationSchemaORM(substation_id=substation_id, canvas_json=canvas_json)
        session.add(schema)
    else:
        schema.canvas_json = canvas_json
    await session.commit()
    await session.refresh(schema)
    return schema


@router.patch("/schemas/{schema_id}", response_model=SubstationSchemaRead)
async def update_schema(
    schema_id: UUID,
    payload: SubstationSchemaUpdate,
    session: AsyncSession = Depends(get_session),
) -> SubstationSchemaORM:
    schema = await get_or_404(session, SubstationSchemaORM, schema_id, "Schema")
    if payload.substation_id is not None:
        await get_or_404(session, SubstationORM, payload.substation_id, "Substation")
    apply_update(schema, payload)
    await session.commit()
    await session.refresh(schema)
    return schema


@router.delete("/schemas/{schema_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schema(schema_id: UUID, session: AsyncSession = Depends(get_session)) -> Response:
    schema = await get_or_404(session, SubstationSchemaORM, schema_id, "Schema")
    await session.delete(schema)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


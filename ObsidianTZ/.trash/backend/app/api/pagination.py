from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any, Literal

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

SortOrder = Literal["asc", "desc"]


class PageParams(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool


class Page[T](BaseModel):
    items: list[T]
    meta: PageMeta


def get_page_params(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


def apply_sort(
    stmt: Select,
    sort_by: str | None,
    sort_order: SortOrder,
    allowed_columns: dict[str, object],
    default_sort: str = "created_at",
) -> Select:
    column = allowed_columns.get(sort_by or default_sort)
    if column is None:
        column = allowed_columns[default_sort]
    if sort_order == "desc":
        return stmt.order_by(column.desc())
    return stmt.order_by(column.asc())


async def paginate(
    session: AsyncSession,
    stmt: Select,
    params: PageParams,
) -> tuple[Sequence[Any], PageMeta]:
    total_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(await session.scalar(total_stmt) or 0)
    result = await session.execute(stmt.offset(params.offset).limit(params.page_size))
    pages = math.ceil(total / params.page_size) if total else 0
    meta = PageMeta(
        page=params.page,
        page_size=params.page_size,
        total=total,
        pages=pages,
        has_next=params.page < pages,
        has_prev=params.page > 1,
    )
    return result.scalars().all(), meta

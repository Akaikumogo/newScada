from __future__ import annotations

from typing import Any

from fastapi import status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError


async def get_or_404(session: AsyncSession, model: type[Any], item_id: Any, label: str) -> Any:
    item = await session.get(model, item_id)
    if item is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "not_found", f"{label} not found.")
    return item


def apply_update(instance: Any, payload: BaseModel) -> None:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(instance, key, value)


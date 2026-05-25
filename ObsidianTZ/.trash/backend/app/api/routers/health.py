from fastapi import APIRouter

from app.core.settings import get_settings
from app.infrastructure.db.session import ping_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
    }


@router.get("/health/db")
async def health_db() -> dict:
    healthy = await ping_database()
    return {"status": "ok" if healthy else "unavailable"}


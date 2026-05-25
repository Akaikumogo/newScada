"""
Shared FastAPI dependencies.
"""
from app.infrastructure.db.database import get_db  # re-export for convenience
from app.infrastructure.cache.redis_cache import get_redis

__all__ = ["get_db", "get_redis"]

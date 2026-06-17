"""
newSCADA Backend — FastAPI entry point.

Start: uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.application.services.record_collector import record_collector
from app.application.services.ping_monitor import ping_monitor
from app.infrastructure.db.database import create_tables
from app.infrastructure.cache.redis_cache import close_redis, init_redis, is_redis_available

from app.api.routers import (
    health,
    branches,
    substations,
    models,
    devices,
    signals,
    telemetry,
    yunusobod,
    logs,
    ws,
    auth,
    backup,
)

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG if settings.DEBUG else logging.INFO))
if settings.LOG_FILE:
    log_path = Path(settings.LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s - %(message)s"))
    root_logger.addHandler(file_handler)


# ──────────────────────────────────────────────
#  Lifespan
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──
    logger.info("▶ Creating DB tables …")
    try:
        await create_tables()
        logger.info("  DB tables OK")
    except Exception as exc:
        logger.warning(
            "  DB not available — start PostgreSQL and restart: %s", exc
        )

    logger.info("▶ Connecting Redis …")
    await init_redis()
    if is_redis_available():
        logger.info("  Redis OK")
    else:
        logger.warning("  Redis offline — using in-memory cache (live values lost on restart)")

    if settings.IEC_RECORD_COLLECTOR_ENABLED:
        logger.info("Starting IEC104 record collector")
        record_collector.start()
    else:
        logger.info("IEC104 record collector disabled")

    if settings.PING_MONITOR_ENABLED:
        logger.info("Starting Ping monitor (online/offline)")
        ping_monitor.start()
    else:
        logger.info("Ping monitor disabled")

    logger.info("▶ Backend tayyor")

    yield  # ← application runs here

    # ── shutdown ──
    logger.info("◀ Shutdown …")
    await record_collector.stop()
    await ping_monitor.stop()
    await close_redis()
    logger.info("◀ Shutdown complete")


# ──────────────────────────────────────────────
#  App
# ──────────────────────────────────────────────

app = FastAPI(
    title="newSCADA API",
    version="1.0.0",
    description="newSCADA backend — REST + WebSocket",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ──────────────────────────────────────────────
#  Routers
# ──────────────────────────────────────────────

API_PREFIX = "/api"

app.include_router(health.router,       prefix=API_PREFIX)
app.include_router(branches.router,     prefix=API_PREFIX)
app.include_router(substations.router,  prefix=API_PREFIX)
app.include_router(models.router,       prefix=API_PREFIX)
app.include_router(devices.router,      prefix=API_PREFIX)
app.include_router(signals.router,      prefix=API_PREFIX)
app.include_router(telemetry.router,    prefix=API_PREFIX)
app.include_router(yunusobod.router,    prefix=API_PREFIX)
app.include_router(logs.router,         prefix=API_PREFIX)
app.include_router(auth.router,         prefix=API_PREFIX)
app.include_router(backup.router,       prefix=API_PREFIX)
app.include_router(ws.router)           # no prefix — mounts at /ws


# ──────────────────────────────────────────────
#  Root redirect
# ──────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {"message": "newSCADA API", "docs": "/api/docs"}

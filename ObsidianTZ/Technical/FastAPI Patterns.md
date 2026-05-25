---
type: technical
tags: [technical, backend, fastapi, patterns, dependency-injection]
status: reference
created: 2026-05-24
related: ["[[Architecture/Clean Architecture]]", "[[Architecture/WebSocket Strategy]]"]
---

# FastAPI Patterns — Backend pattern to'plami

---

## Dependency Injection zanjiri

```python
# api/dependencies.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from functools import lru_cache

from ..infrastructure.db.session import AsyncSessionLocal
from ..infrastructure.cache.redis_cache import RedisCache
from ..infrastructure.db.repositories import (
    BranchRepository, SubstationRepository,
    DeviceRepository, RecordRepository,
)
from ..application.commands.branch import BranchCommands
from ..application.queries.telemetry import TelemetryQueries

# ── DB Session ────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

# ── Repositories ──────────────────────────────────────────
def get_device_repo(db: AsyncSession = Depends(get_db)) -> DeviceRepository:
    return DeviceRepository(db)

def get_record_repo(db: AsyncSession = Depends(get_db)) -> RecordRepository:
    return RecordRepository(db)

# ── Use Cases / Commands ──────────────────────────────────
def get_branch_commands(
    db: AsyncSession = Depends(get_db),
) -> BranchCommands:
    return BranchCommands(
        branch_repo=BranchRepository(db),
        substation_repo=SubstationRepository(db),
    )

# ── Cache ─────────────────────────────────────────────────
@lru_cache
def get_redis() -> RedisCache:
    return RedisCache(settings.redis_url)

def get_telemetry_queries(
    cache: RedisCache = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> TelemetryQueries:
    return TelemetryQueries(cache=cache, record_repo=RecordRepository(db))
```

---

## Router pattern

```python
# api/routers/devices.py
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/api/devices", tags=["devices"])

@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: int,
    repo: DeviceRepository = Depends(get_device_repo),
):
    device = await repo.get_with_signals(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.post("/", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate,
    commands: DeviceCommands = Depends(get_device_commands),
):
    return await commands.create(body)

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    commands: DeviceCommands = Depends(get_device_commands),
):
    deleted = await commands.delete(device_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Device not found")
```

---

## Global Exception Handler

```python
# api/main.py
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(EntityNotFoundError)
async def not_found_handler(req: Request, exc: EntityNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})

@app.exception_handler(ValidationError)
async def validation_handler(req: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

@app.exception_handler(ConflictError)
async def conflict_handler(req: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})
```

---

## Lifespan — startup/shutdown

```python
# api/main.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────
    await run_migrations()                        # Alembic

    async with AsyncSessionLocal() as db:
        devices = await DeviceRepository(db).list_active()

    collector_tasks = await start_all_collectors(devices, event_bus)

    app.state.collector_tasks = collector_tasks
    app.state.event_bus = event_bus

    yield  # ← server ishlaydi

    # ── Shutdown ──────────────────────────────────────────
    for task in collector_tasks:
        task.cancel()
    await asyncio.gather(*collector_tasks, return_exceptions=True)
    await redis.close()
    await engine.dispose()


app = FastAPI(lifespan=lifespan)
```

---

## Middleware stack

```python
# api/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import time

# 1. CORS
app.add_middleware(CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Gzip (katta JSON response lar uchun)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 3. Request logging + timing
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time"] = f"{elapsed:.1f}ms"
    return response
```

---

## Pydantic v2 schemas

```python
# api/schemas/device.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal

class DeviceCreate(BaseModel):
    substation_id: int   = Field(gt=0)
    model_id:      int   = Field(gt=0)
    name:          str   = Field(min_length=1, max_length=120)
    protocol:      Literal["iec104"] = "iec104"

class SignalCreate(BaseModel):
    register_code: int    = Field(gt=0, description="IEC104 IOA")
    signal_name:   str    = Field(min_length=1, max_length=64,
                                   pattern=r"^[a-z][a-z0-9_]*$")
    signal_title:  str    = Field(min_length=1, max_length=160)
    unit:          str    = Field(default="", max_length=24)
    value_type:    Literal["float", "status"] = "float"

    @field_validator("signal_name")
    @classmethod
    def lowercase_name(cls, v: str) -> str:
        return v.lower()
```

---

## Bog'liq
- [[Architecture/Clean Architecture]]
- [[Architecture/WebSocket Strategy]]
- [[Architecture/DB Strategy]]

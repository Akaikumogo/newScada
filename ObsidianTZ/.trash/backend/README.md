# TEST127 Backend

Production-oriented FastAPI backend for the TEST127 SCADA project.

## Features

- UUIDv7 IDs for every domain entity.
- Consistent pagination response: `items` + `meta`.
- Search, filter, and sort support on list endpoints.
- `GET /{resource}/{id}` endpoint for every resource.
- Async SQLAlchemy 2.x and Alembic migrations.
- Central settings, logging, health checks, and error responses.

## Local setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Checks

```powershell
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m alembic history
```

## Main API

- `GET /health`
- `GET /api/branches`
- `GET /api/branches/{branch_id}`
- `GET /api/substations`
- `GET /api/substations/{substation_id}`
- `GET /api/models`
- `GET /api/models/{model_id}`
- `GET /api/devices`
- `GET /api/devices/{device_id}`
- `GET /api/signals`
- `GET /api/signals/{signal_id}`
- `GET /api/schemas`
- `GET /api/schemas/{schema_id}`
- `GET /api/records`
- `GET /api/records/{record_id}`


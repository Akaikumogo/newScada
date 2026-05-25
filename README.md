# ObsidiaTZ

ObsidiaTZ is a SCADA foundation for the Yunusobod substation workflow:

- `backend` - FastAPI API, PostgreSQL models, telemetry endpoints and WebSocket.
- `frontend` - Dispatcher read-only monitoring UI.
- `EDITOR` - Configuration/admin UI.
- `ObsidianTZ` - project vault, architecture notes and production work report.

## Quick start with Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Services:

- Backend API: `http://localhost:8000`
- Dispatcher: `http://localhost:5173`
- Editor: `http://localhost:5174`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Backend local checks

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
```

## Frontend checks

```powershell
cd frontend
npm install
npm run build

cd ..\EDITOR
npm install
npm run build
```

## Database migration

```powershell
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
```

## Report

Work log is maintained in `ObsidianTZ/REPORT.md`.


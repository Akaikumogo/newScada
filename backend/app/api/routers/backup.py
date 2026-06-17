"""
Database backup — download (pg_dump) and upload (pg_restore / psql).

GET  /api/backup/download  → streams *.dump file
POST /api/backup/upload    → restores from uploaded *.dump or *.sql file
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, unquote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.api.routers.auth import require_auth
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backup", tags=["backup"])


def _parse_db_url() -> dict:
    """Parse DATABASE_URL → dict for pg_dump / pg_restore env."""
    url = settings.DATABASE_URL
    # postgresql+asyncpg://user:pass@host:port/db  →  drop driver
    if "+" in url.split("://", 1)[0]:
        scheme, rest = url.split("://", 1)
        url = scheme.split("+", 1)[0] + "://" + rest
    p = urlparse(url)
    return {
        "host": p.hostname or "localhost",
        "port": str(p.port or 5432),
        "user": unquote(p.username or ""),
        "password": unquote(p.password or ""),
        "dbname": (p.path or "/").lstrip("/") or "postgres",
    }


def _tool_path(name: str) -> str:
    """Resolve pg_dump / pg_restore / psql path (Windows-friendly)."""
    exe = name + (".exe" if os.name == "nt" else "")
    found = shutil.which(exe)
    if found:
        return found
    # Common Windows install paths
    if os.name == "nt":
        for root in (r"C:\Program Files\PostgreSQL", r"C:\Program Files (x86)\PostgreSQL"):
            if os.path.isdir(root):
                for ver in sorted(os.listdir(root), reverse=True):
                    candidate = os.path.join(root, ver, "bin", exe)
                    if os.path.isfile(candidate):
                        return candidate
    raise HTTPException(
        status_code=500,
        detail=f"{name} topilmadi. PostgreSQL client tools o'rnatilganini tekshiring.",
    )


async def _run(cmd: list[str], env: dict, stdin: bytes | None = None) -> tuple[int, bytes, bytes]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        env=env,
        stdin=asyncio.subprocess.PIPE if stdin is not None else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate(input=stdin)
    return proc.returncode or 0, out, err


@router.get("/download", dependencies=[Depends(require_auth)])
async def download_backup(background: BackgroundTasks):
    """Run pg_dump in custom format and stream the resulting file."""
    db = _parse_db_url()
    pg_dump = _tool_path("pg_dump")

    tmp = tempfile.NamedTemporaryFile(prefix="newscada_", suffix=".dump", delete=False)
    tmp.close()
    out_path = Path(tmp.name)

    env = {**os.environ, "PGPASSWORD": db["password"]}
    cmd = [
        pg_dump,
        "-h", db["host"],
        "-p", db["port"],
        "-U", db["user"],
        "-d", db["dbname"],
        "-F", "c",        # custom format → pg_restore
        "--no-owner",
        "--no-acl",
        "-f", str(out_path),
    ]

    rc, _, err = await _run(cmd, env)
    if rc != 0:
        try:
            out_path.unlink()
        except OSError:
            pass
        msg = err.decode("utf-8", errors="replace").strip() or "pg_dump xatosi"
        logger.error("pg_dump failed: %s", msg)
        raise HTTPException(status_code=500, detail=msg)

    background.add_task(lambda: out_path.unlink(missing_ok=True))
    fname = f"newscada_{datetime.now().strftime('%Y%m%d_%H%M%S')}.dump"
    return FileResponse(
        path=str(out_path),
        filename=fname,
        media_type="application/octet-stream",
    )


@router.post("/upload", dependencies=[Depends(require_auth)])
async def upload_backup(file: UploadFile = File(...)):
    """Restore database from uploaded pg_dump file (.dump or .sql)."""
    db = _parse_db_url()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Bo'sh fayl")

    name = (file.filename or "").lower()
    is_sql = name.endswith(".sql")

    env = {**os.environ, "PGPASSWORD": db["password"]}

    if is_sql:
        psql = _tool_path("psql")
        cmd = [
            psql,
            "-h", db["host"],
            "-p", db["port"],
            "-U", db["user"],
            "-d", db["dbname"],
            "-v", "ON_ERROR_STOP=1",
        ]
        rc, _, err = await _run(cmd, env, stdin=content)
    else:
        pg_restore = _tool_path("pg_restore")
        tmp = tempfile.NamedTemporaryFile(prefix="restore_", suffix=".dump", delete=False)
        try:
            tmp.write(content)
            tmp.close()
            cmd = [
                pg_restore,
                "-h", db["host"],
                "-p", db["port"],
                "-U", db["user"],
                "-d", db["dbname"],
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-acl",
                tmp.name,
            ]
            rc, _, err = await _run(cmd, env)
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    if rc != 0:
        msg = err.decode("utf-8", errors="replace").strip() or "restore xatosi"
        logger.error("restore failed: %s", msg)
        raise HTTPException(status_code=500, detail=msg)

    return {"ok": True, "restored_bytes": len(content), "filename": file.filename}

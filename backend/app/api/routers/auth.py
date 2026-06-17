"""
Simple admin auth for the editor.

Default credentials: admin / admin (override via EDITOR_USER / EDITOR_PASS env).
The server returns a fixed token on successful login; the client sends it back
via the `Authorization: Bearer <token>` header for protected endpoints.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

_USER = os.environ.get("EDITOR_USER", "admin")
_PASS = os.environ.get("EDITOR_PASS", "admin")

# Stable token derived from creds — survives restarts so the UI doesn't
# get kicked out every time the backend redeploys.
_SECRET = os.environ.get("EDITOR_SECRET", "newscada-editor-default-secret")
_TOKEN = hashlib.sha256(f"{_USER}:{_PASS}:{_SECRET}".encode()).hexdigest()


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    username: str


def require_auth(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Avtorizatsiya talab qilinadi")
    token = authorization.split(" ", 1)[1].strip()
    if not secrets.compare_digest(token, _TOKEN):
        raise HTTPException(status_code=401, detail="Token noto'g'ri")
    return _USER


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn):
    user_ok = hmac.compare_digest(body.username, _USER)
    pass_ok = hmac.compare_digest(body.password, _PASS)
    if not (user_ok and pass_ok):
        raise HTTPException(status_code=401, detail="Login yoki parol noto'g'ri")
    return LoginOut(token=_TOKEN, username=_USER)


@router.get("/me")
async def me(user: str = Depends(require_auth)):
    return {"username": user}

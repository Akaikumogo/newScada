from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.infrastructure.events.bus import bus
from app.infrastructure.events.log_stream import matches_log_filter, recent_logs

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

PING_INTERVAL = 20


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    queue = bus.subscribe()
    logger.info("WS client connected - total: %d", bus.subscriber_count)

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=PING_INTERVAL)
            except asyncio.TimeoutError:
                event = {"type": "ping"}
            await ws.send_json(event)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        bus.unsubscribe(queue)
        logger.info("WS client disconnected - total: %d", bus.subscriber_count)


@router.websocket("/ws/log")
async def log_websocket_endpoint(
    ws: WebSocket,
    device_id: int | None = None,
    register_code: int | None = None,
    signal_name: str | None = None,
):
    await ws.accept()
    queue = bus.subscribe()
    logger.info("WS log client connected - total: %d", bus.subscriber_count)

    try:
        await ws.send_json({
            "type": "snapshot",
            "items": recent_logs(
                device_id=device_id,
                register_code=register_code,
                signal_name=signal_name,
                limit=200,
            ),
        })

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=PING_INTERVAL)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue

            if matches_log_filter(
                event,
                device_id=device_id,
                register_code=register_code,
                signal_name=signal_name,
            ):
                await ws.send_json(event)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        bus.unsubscribe(queue)
        logger.info("WS log client disconnected - total: %d", bus.subscriber_count)

"""
WebSocket endpoint — streams live updates to frontend clients.

Message format (sent to client):
{
  "type": "signal_update",
  "device_id": 1,
  "signal_name": "U_A",
  "value": 220.5,
  "quality": 0,
  "ts": "2024-01-01T12:00:00Z"
}
{
  "type": "device_status",
  "device_id": 1,
  "online": true,
  "last_seen": "2024-01-01T12:00:00Z"
}
{
  "type": "ping"
}
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.infrastructure.events.bus import bus
from app.infrastructure.events.log_stream import matches_log_filter, recent_logs

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

PING_INTERVAL = 20  # seconds


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    queue = bus.subscribe()
    logger.info("WS client connected — total: %d", bus.subscriber_count)

    ping_task = asyncio.create_task(_ping_loop(ws))

    try:
        while True:
            # Wait for either a new event or a client message
            get_task = asyncio.create_task(queue.get())
            recv_task = asyncio.create_task(ws.receive_text())

            done, pending = await asyncio.wait(
                [get_task, recv_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            for t in pending:
                t.cancel()

            for task in done:
                if task is get_task:
                    event = task.result()
                    await ws.send_text(json.dumps(event))
                elif task is recv_task:
                    # handle pong or ignore
                    try:
                        msg = json.loads(task.result())
                        if msg.get("type") == "pong":
                            pass  # keep-alive acknowledged
                    except Exception:
                        pass

    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ping_task.cancel()
        bus.unsubscribe(queue)
        logger.info("WS client disconnected — total: %d", bus.subscriber_count)


async def _ping_loop(ws: WebSocket) -> None:
    """Send periodic pings to keep the connection alive."""
    try:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            await ws.send_text(json.dumps({"type": "ping"}))
    except Exception:
        pass


@router.websocket("/ws/log")
async def log_websocket_endpoint(
    ws: WebSocket,
    device_id: int | None = None,
    register_code: int | None = None,
    signal_name: str | None = None,
):
    await ws.accept()
    queue = bus.subscribe()
    logger.info("WS log client connected — total: %d", bus.subscriber_count)

    ping_task = asyncio.create_task(_ping_loop(ws))

    try:
        await ws.send_text(json.dumps({
            "type": "snapshot",
            "items": recent_logs(
                device_id=device_id,
                register_code=register_code,
                signal_name=signal_name,
                limit=200,
            ),
        }))

        while True:
            get_task = asyncio.create_task(queue.get())
            recv_task = asyncio.create_task(ws.receive_text())

            done, pending = await asyncio.wait(
                [get_task, recv_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            for t in pending:
                t.cancel()

            for task in done:
                if task is get_task:
                    event = task.result()
                    if matches_log_filter(
                        event,
                        device_id=device_id,
                        register_code=register_code,
                        signal_name=signal_name,
                    ):
                        await ws.send_text(json.dumps(event))
                elif task is recv_task:
                    try:
                        msg = json.loads(task.result())
                        if msg.get("type") == "pong":
                            pass
                    except Exception:
                        pass

    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ping_task.cancel()
        bus.unsubscribe(queue)
        logger.info("WS log client disconnected — total: %d", bus.subscriber_count)

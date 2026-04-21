"""WebSocket /stream endpoint."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket

from app.services.websocket.stream_handler import ConnectionManager

router = APIRouter(tags=["WebSocket"])

_manager: ConnectionManager | None = None


def set_manager(manager: ConnectionManager) -> None:
    global _manager
    _manager = manager


@router.websocket("/stream")
async def stream(websocket: WebSocket) -> None:
    """Real-time gesture recognition stream.

    Connect via ``ws://localhost:8000/stream``.

    **Client → Server** (JSON text frame)::

        {
            "session_id": "<uuid>",
            "frame": "<base64_jpeg>"   // option A
        }

        // or option B (pre-extracted landmarks):
        {
            "session_id": "<uuid>",
            "landmarks": [<63 floats>]
        }

    **Server → Client** (JSON text frame)::

        {
            "gesture":            "swipe_left" | null,
            "confidence":         0.95,
            "action":             "navigate_back" | null,
            "buffer_fill":        0.75,
            "landmarks_detected": true,
            "error":              null
        }

    ``buffer_fill`` is a value in [0, 1] indicating how full the per-session
    sequence buffer is.  A prediction is emitted (and the buffer reset) once
    ``buffer_fill`` reaches 1.
    """
    if _manager is None:
        await websocket.accept()
        await websocket.send_text(
            '{"error": "ConnectionManager not initialised."}'
        )
        await websocket.close()
        return

    await _manager.handle(websocket)

"""WebSocket connection and frame-streaming handler.

Each connected client is identified by a ``session_id`` string.  The handler
maintains a per-session sequence buffer.  When the buffer reaches the model's
expected sequence length, inference is performed and the result is sent back.

Message protocol
----------------
Client → Server (JSON):
    {
        "session_id": "<uuid>",
        "frame":      "<base64_jpeg>",   // option A: server extracts landmarks
        "landmarks":  [<63 floats>]      // option B: pre-extracted by browser
    }

Server → Client (JSON):
    {
        "gesture":            "swipe_left" | null,
        "confidence":         0.95 | null,
        "action":             "navigate_back" | null,
        "buffer_fill":        0.75,
        "landmarks_detected": true,
        "error":              null | "<message>"
    }
"""
from __future__ import annotations

import logging
from collections import deque
from typing import Optional

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from app.models.schemas import WSClientMessage, WSServerMessage
from app.services.inference.predictor import GesturePredictor
from app.services.mediapipe.landmark_extractor import (
    FEATURE_SIZE,
    HandLandmarkExtractor,
)
from app.utils.config import AppConfig, get_config
from app.utils.gesture_actions import get_action

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and per-session sequence buffers.

    Parameters
    ----------
    predictor:
        Shared :class:`~app.services.inference.predictor.GesturePredictor`
        instance.
    config:
        Application configuration.
    """

    def __init__(
        self,
        predictor: GesturePredictor,
        config: Optional[AppConfig] = None,
    ) -> None:
        self._predictor = predictor
        self._cfg = config or get_config()
        self._extractor = HandLandmarkExtractor(
            num_hands=self._cfg.dataset.num_hands
        )
        # session_id → deque of landmark vectors
        self._buffers: dict[str, deque[np.ndarray]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def handle(self, websocket: WebSocket) -> None:
        """Accept and serve a single WebSocket connection.

        Runs until the client disconnects or an unrecoverable error occurs.

        Parameters
        ----------
        websocket:
            The FastAPI ``WebSocket`` instance for this connection.
        """
        await websocket.accept()
        session_id: Optional[str] = None

        try:
            while True:
                raw = await websocket.receive_text()
                response = await self._process_message(raw)
                if response.error and session_id is None:
                    # Can't do much without a session_id — just echo error
                    await websocket.send_text(response.model_dump_json())
                    continue
                await websocket.send_text(response.model_dump_json())

        except WebSocketDisconnect:
            if session_id:
                self._buffers.pop(session_id, None)
            logger.info("WebSocket session '%s' disconnected.", session_id)
        except Exception as exc:
            logger.exception("WebSocket error: %s", exc)
            try:
                err_msg = WSServerMessage(error=str(exc))
                await websocket.send_text(err_msg.model_dump_json())
            except Exception:
                pass
        finally:
            if session_id:
                self._buffers.pop(session_id, None)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _process_message(self, raw: str) -> WSServerMessage:
        """Parse an incoming message and return a server response."""
        try:
            msg = WSClientMessage.model_validate_json(raw)
        except Exception as exc:
            return WSServerMessage(error=f"Invalid message format: {exc}")

        session_id = msg.session_id
        buf = self._get_buffer(session_id)
        seq_len = self._predictor._sequence_length if self._predictor.is_loaded else self._cfg.dataset.sequence_length

        # ---- Extract / receive landmarks ----
        landmarks: Optional[np.ndarray] = None

        if msg.landmarks is not None:
            # Option B: pre-extracted by the browser
            if len(msg.landmarks) == FEATURE_SIZE:
                landmarks = np.array(msg.landmarks, dtype=np.float32)
            else:
                return WSServerMessage(
                    error=f"landmarks must have {FEATURE_SIZE} values, got {len(msg.landmarks)}.",
                    buffer_fill=len(buf) / seq_len,
                )

        elif msg.frame is not None:
            # Option A: server-side extraction
            landmarks = self._extractor.extract_from_base64(msg.frame)

        else:
            return WSServerMessage(
                error="Message must contain either 'frame' or 'landmarks'.",
                buffer_fill=len(buf) / seq_len,
            )

        landmarks_detected = landmarks is not None

        if landmarks_detected:
            buf.append(landmarks)

        buffer_fill = min(len(buf) / seq_len, 1.0)

        # ---- Run inference when buffer is full ----
        if len(buf) < seq_len or not self._predictor.is_loaded:
            return WSServerMessage(
                landmarks_detected=landmarks_detected,
                buffer_fill=buffer_fill,
            )

        sequence = np.array(list(buf), dtype=np.float32)  # (seq_len, 63)
        buf.clear()  # reset for next window

        gesture, confidence, _ = self._predictor.predict(sequence)
        action = get_action(gesture) if gesture != "unknown" else None

        return WSServerMessage(
            gesture=gesture if gesture != "unknown" else None,
            confidence=round(confidence, 4),
            action=action,
            buffer_fill=0.0,
            landmarks_detected=landmarks_detected,
        )

    def _get_buffer(self, session_id: str) -> deque[np.ndarray]:
        if session_id not in self._buffers:
            self._buffers[session_id] = deque()
        return self._buffers[session_id]

    def cleanup(self) -> None:
        """Release MediaPipe resources and clear all session buffers."""
        self._extractor.close()
        self._buffers.clear()

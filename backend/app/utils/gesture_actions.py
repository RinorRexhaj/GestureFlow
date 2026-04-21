"""Gesture → browser action mapping.

This module is the single source of truth for the action layer.
It is intentionally aligned with the frontend ``actions.ts`` file so both
sides speak the same vocabulary.

Gesture names (keys) must match the labels used during model training.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Mapping: gesture label → browser action identifier
# ---------------------------------------------------------------------------
#
# Action identifiers are consumed by the frontend to decide what DOM action
# to perform.  Keep them in sync with the frontend ``GESTURE_ACTION_MAP``.
#
GESTURE_ACTION_MAP: dict[str, str] = {
    "swipe_left": "navigate_back",
    "swipe_right": "navigate_forward",
    "click": "trigger_click",
    "scroll_up": "scroll_up",
    "scroll_down": "scroll_down",
    "pinch": "zoom_in",
    "open_hand": "zoom_out",
    "thumbs_up": "like",
    "thumbs_down": "dislike",
    "peace": "screenshot",
    "fist": "stop",
}


def get_action(gesture_name: str) -> str | None:
    """Return the browser action for *gesture_name*, or ``None`` if unmapped.

    Parameters
    ----------
    gesture_name:
        Lowercase gesture label as produced by the LSTM model.

    Returns
    -------
    str or None
    """
    return GESTURE_ACTION_MAP.get(gesture_name.lower())

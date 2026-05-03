"""Utility helpers for detecting intentional hand movement in landmark sequences."""
from __future__ import annotations

import numpy as np


def has_sufficient_movement(
    sequence: np.ndarray,
    peak_threshold: float = 0.15,
) -> bool:
    """Return ``True`` if *sequence* contains at least one sharp movement frame.

    Computes the L2 norm of the per-frame landmark delta across the entire
    sequence window and checks whether the **peak** value exceeds
    *peak_threshold*.  A hand that is still or drifting slowly will not
    surpass the threshold; a deliberate gesture (swipe, zoom, etc.) produces
    at least one large frame-to-frame jump that will.

    Parameters
    ----------
    sequence:
        Landmark sequence of shape ``(seq_len, num_features)``.
    peak_threshold:
        Minimum L2 norm of a single-frame delta required to count as
        intentional movement.  Lower values are more sensitive; higher values
        require more decisive motion.

    Returns
    -------
    bool
        ``True`` if a sharp enough movement was detected in the window.
    """
    if len(sequence) < 2:
        return False

    diffs = np.diff(sequence, axis=0)            # (seq_len-1, num_features)
    frame_deltas = np.linalg.norm(diffs, axis=1)  # (seq_len-1,)
    return float(np.max(frame_deltas)) >= peak_threshold

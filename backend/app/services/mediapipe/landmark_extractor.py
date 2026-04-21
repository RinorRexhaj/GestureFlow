"""Hand landmark extraction using MediaPipe Hands.

Produces a normalised 63-dimensional feature vector per frame:
  - 21 landmarks × (x, y, z)
  - Wrist-relative: landmark[0] (wrist) is subtracted from all landmarks
  - Scale-normalised: divided by the bounding-box diagonal
"""
from __future__ import annotations

import base64
import logging
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)

# Number of hand landmarks produced by MediaPipe
NUM_LANDMARKS = 21
FEATURE_SIZE = NUM_LANDMARKS * 3  # 63


class HandLandmarkExtractor:
    """Stateless MediaPipe wrapper that extracts normalised landmark vectors.

    Parameters
    ----------
    num_hands:
        Maximum number of hands to detect (1 = single-hand mode).
    min_detection_confidence:
        Minimum confidence for hand detection.
    min_tracking_confidence:
        Minimum confidence for landmark tracking.
    """

    def __init__(
        self,
        num_hands: int = 1,
        min_detection_confidence: float = 0.7,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        self._hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=num_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.num_hands = num_hands
        self._last_hand_landmarks = None  # set after each extract_from_frame call

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_from_frame(self, frame_bgr: np.ndarray) -> Optional[np.ndarray]:
        """Extract a normalised landmark vector from a BGR image frame.

        Parameters
        ----------
        frame_bgr:
            OpenCV BGR image as a NumPy array.

        Returns
        -------
        np.ndarray or None
            Flat normalised vector of shape ``(63,)``, or ``None`` if no hand
            is detected.
        """
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        result = self._hands.process(frame_rgb)

        if not result.multi_hand_landmarks:
            self._last_hand_landmarks = None
            return None

        # Use the first detected hand
        hand_landmarks = result.multi_hand_landmarks[0]
        self._last_hand_landmarks = hand_landmarks
        return self._normalise(hand_landmarks.landmark)

    def extract_from_bytes(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Extract landmarks from raw image bytes (JPEG / PNG).

        Parameters
        ----------
        image_bytes:
            Raw image data.

        Returns
        -------
        np.ndarray or None
        """
        nparr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            logger.warning("Failed to decode image bytes — skipping frame.")
            return None
        return self.extract_from_frame(frame)

    def extract_from_base64(self, b64_string: str) -> Optional[np.ndarray]:
        """Extract landmarks from a base64-encoded image string.

        Strips optional data-URI prefix (``data:image/...;base64,``).

        Parameters
        ----------
        b64_string:
            Base64-encoded image.

        Returns
        -------
        np.ndarray or None
        """
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(b64_string)
        except Exception as exc:
            logger.warning("Base64 decode error: %s", exc)
            return None
        return self.extract_from_bytes(image_bytes)

    def draw_landmarks(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Draw the most recently detected hand landmarks onto a BGR frame.

        Must be called after ``extract_from_frame``.  Returns the annotated
        frame (a copy; the original is not modified).
        """
        annotated = frame_bgr.copy()
        if self._last_hand_landmarks is not None:
            mp.solutions.drawing_utils.draw_landmarks(
                annotated,
                self._last_hand_landmarks,
                mp.solutions.hands.HAND_CONNECTIONS,
            )
        return annotated

    def close(self) -> None:
        """Release MediaPipe resources."""
        self._hands.close()

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    def __enter__(self) -> "HandLandmarkExtractor":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise(landmarks: list) -> np.ndarray:
        """Normalise landmarks to a wrist-relative, scale-invariant vector.

        Steps:
          1. Convert to NumPy array shaped ``(21, 3)``.
          2. Subtract the wrist landmark (index 0) → wrist-relative.
          3. Compute bounding-box diagonal.
          4. Divide by the diagonal (avoid division by zero).
          5. Flatten to ``(63,)``.

        Parameters
        ----------
        landmarks:
            Raw ``NormalizedLandmark`` objects from MediaPipe (21 entries).

        Returns
        -------
        np.ndarray
            Shape ``(63,)``.
        """
        coords = np.array(
            [[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32
        )  # (21, 3)

        # Wrist-relative translation
        wrist = coords[0].copy()
        coords -= wrist

        # Scale by bounding-box diagonal (using x, y only for stability)
        xy = coords[:, :2]
        min_xy = xy.min(axis=0)
        max_xy = xy.max(axis=0)
        diagonal = float(np.linalg.norm(max_xy - min_xy))

        if diagonal > 1e-6:
            coords /= diagonal

        return coords.flatten()  # (63,)

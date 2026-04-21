"""Dataset recording pipeline.

Records gesture sequences from a webcam and saves them as CSV files under::

    datasets/{gesture_name}/sample_NNN.csv

Each CSV has no header; rows are frames and columns are the 63 landmark values.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import pandas as pd

from app.services.mediapipe.landmark_extractor import (
    FEATURE_SIZE,
    HandLandmarkExtractor,
)
from app.utils.config import AppConfig, get_config

logger = logging.getLogger(__name__)


class DatasetRecorder:
    """Records and saves hand gesture sequences.

    Parameters
    ----------
    config:
        Application configuration. Falls back to the global singleton.
    """

    def __init__(self, config: Optional[AppConfig] = None) -> None:
        self._cfg = config or get_config()
        self._datasets_dir = self._cfg.paths.datasets_path

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record_from_webcam(
        self,
        gesture_name: str,
        num_samples: int = 10,
        sequence_length: Optional[int] = None,
        camera_index: int = 0,
        countdown_seconds: int = 3,
    ) -> list[Path]:
        """Interactively record gesture samples from a webcam.

        A countdown is shown before each sample.  Press **q** at any time to
        abort recording.

        Parameters
        ----------
        gesture_name:
            Label for the gesture being recorded.
        num_samples:
            Number of samples to collect.
        sequence_length:
            Frames per sample.  Defaults to ``config.dataset.sequence_length``.
        camera_index:
            OpenCV camera index.
        countdown_seconds:
            Seconds to show the countdown before each recording starts.

        Returns
        -------
        list[Path]
            Paths of the saved CSV files.
        """
        seq_len = sequence_length or self._cfg.dataset.sequence_length
        extractor = HandLandmarkExtractor(num_hands=self._cfg.dataset.num_hands)
        cap = cv2.VideoCapture(camera_index)

        if not cap.isOpened():
            raise RuntimeError(f"Cannot open camera at index {camera_index}.")

        # Warm up the camera — first few frames can be black on some devices
        for _ in range(10):
            cap.read()

        saved: list[Path] = []
        sample_idx = self._next_sample_index(gesture_name)

        print(f"\nRecording '{gesture_name}' — {num_samples} samples of {seq_len} frames each.")
        print("Hold your hand clearly in front of the camera. Press Ctrl+C to stop early.\n")

        try:
            for sample_num in range(num_samples):
                print(f"  Sample {sample_num + 1}/{num_samples} — get ready...", end="", flush=True)

                # Countdown: drain frames for countdown_seconds without blocking
                deadline = time.time() + countdown_seconds
                while time.time() < deadline:
                    ret_cd, frame_cd = cap.read()
                    if ret_cd and frame_cd is not None:
                        remaining = max(0.0, deadline - time.time())
                        display_cd = frame_cd.copy()
                        cv2.putText(
                            display_cd,
                            f"{gesture_name}  — get ready  {remaining:.1f}s",
                            (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 255), 2, cv2.LINE_AA,
                        )
                        cv2.imshow("GestureFlow — Recording", display_cd)
                        cv2.waitKey(1)

                print(" recording...", end="", flush=True)

                # Recording phase — collect seq_len landmark vectors
                sequence: list[np.ndarray] = []
                missed = 0
                while len(sequence) < seq_len:
                    ret, frame = cap.read()
                    if not ret:
                        missed += 1
                        if missed > 60:
                            raise RuntimeError("Camera stopped delivering frames.")
                        continue
                    missed = 0
                    vector = extractor.extract_from_frame(frame)
                    # Show annotated feed
                    display = extractor.draw_landmarks(frame)
                    progress = len(sequence) / seq_len
                    bar_w = int(display.shape[1] * progress)
                    cv2.rectangle(display, (0, display.shape[0] - 8), (bar_w, display.shape[0]), (0, 220, 0), -1)
                    label = f"{gesture_name}  [{len(sequence)}/{seq_len}]"
                    cv2.putText(display, label, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 220, 0), 2, cv2.LINE_AA)
                    cv2.imshow("GestureFlow — Recording", display)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        raise KeyboardInterrupt
                    if vector is not None:
                        sequence.append(vector)

                path = self.save_sequence(gesture_name, sequence, sample_idx)
                saved.append(path)
                sample_idx += 1
                print(f" saved -> {path.name}")

        except KeyboardInterrupt:
            print("\nRecording stopped by user.")
        finally:
            cap.release()
            extractor.close()
            cv2.destroyAllWindows()

        return saved

    def save_sequence(
        self,
        gesture_name: str,
        sequence: list[np.ndarray],
        sample_index: Optional[int] = None,
        sequence_length: Optional[int] = None,
    ) -> Path:
        """Persist a single gesture sequence to a CSV file.

        Short sequences are zero-padded; long sequences are truncated.

        Parameters
        ----------
        gesture_name:
            Label for the gesture.
        sequence:
            List of landmark vectors (each shape ``(63,)``).
        sample_index:
            Numeric suffix for the file name.  Auto-increments if ``None``.
        sequence_length:
            Target length.  Defaults to ``config.dataset.sequence_length``.

        Returns
        -------
        Path
            Path to the saved CSV file.
        """
        seq_len = sequence_length or self._cfg.dataset.sequence_length

        # Pad or truncate
        adjusted = self._adjust_length(sequence, seq_len)

        gesture_dir = self._datasets_dir / gesture_name
        gesture_dir.mkdir(parents=True, exist_ok=True)

        if sample_index is None:
            sample_index = self._next_sample_index(gesture_name)

        file_path = gesture_dir / f"sample_{sample_index:03d}.csv"
        df = pd.DataFrame(adjusted, columns=[f"f{i}" for i in range(FEATURE_SIZE)])
        df.to_csv(file_path, index=False)
        return file_path

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _next_sample_index(self, gesture_name: str) -> int:
        """Return the next available sample index for a gesture directory."""
        gesture_dir = self._datasets_dir / gesture_name
        if not gesture_dir.exists():
            return 1
        existing = sorted(gesture_dir.glob("sample_*.csv"))
        if not existing:
            return 1
        last = existing[-1].stem  # e.g. "sample_007"
        try:
            return int(last.split("_")[-1]) + 1
        except ValueError:
            return len(existing) + 1

    @staticmethod
    def _adjust_length(
        sequence: list[np.ndarray], target_length: int
    ) -> np.ndarray:
        """Pad (with zeros) or truncate a sequence to ``target_length`` frames.

        Parameters
        ----------
        sequence:
            List of vectors each shaped ``(63,)``.
        target_length:
            Desired number of frames.

        Returns
        -------
        np.ndarray
            Shape ``(target_length, 63)``.
        """
        arr = np.array(sequence, dtype=np.float32)  # (N, 63)
        n = len(arr)

        if n >= target_length:
            return arr[:target_length]

        pad = np.zeros((target_length - n, FEATURE_SIZE), dtype=np.float32)
        return np.vstack([arr, pad])

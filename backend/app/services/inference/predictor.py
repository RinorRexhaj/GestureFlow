"""Real-time inference service.

Loads a trained GestureLSTM from disk and exposes a ``predict`` method that
accepts a landmark sequence and returns the predicted gesture name plus
confidence score.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch

from app.models.lstm_model import GestureLSTM
from app.utils.config import AppConfig, ModelConfig, get_config

logger = logging.getLogger(__name__)


class GesturePredictor:
    """Wraps a loaded GestureLSTM for inference.

    Typical usage
    -------------
    ::

        predictor = GesturePredictor()
        predictor.load("gesture_model_1714000000")

        # sequence shape: (seq_len, 63)
        gesture, confidence = predictor.predict(sequence_array)

    Parameters
    ----------
    config:
        Application config.
    """

    def __init__(self, config: Optional[AppConfig] = None) -> None:
        self._cfg = config or get_config()
        self._device = self._resolve_device(self._cfg.inference.device)

        self._model: Optional[GestureLSTM] = None
        self._label_map: dict[str, int] = {}
        self._idx_to_label: dict[int, str] = {}
        self._sequence_length: int = self._cfg.dataset.sequence_length
        self._loaded_name: Optional[str] = None

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def loaded_name(self) -> Optional[str]:
        return self._loaded_name

    @property
    def label_map(self) -> dict[str, int]:
        return dict(self._label_map)

    @property
    def num_classes(self) -> int:
        return len(self._label_map)

    # ------------------------------------------------------------------
    # Load / unload
    # ------------------------------------------------------------------

    def load(self, model_name: str) -> None:
        """Load a model by its base name (without file extension).

        Looks for ``{model_name}.pt`` and ``{model_name}_meta.json`` inside
        ``saved_models/``.

        Parameters
        ----------
        model_name:
            Base name of the model, e.g. ``"gesture_model_1714000000"``.
        """
        models_dir = self._cfg.paths.saved_models_path
        pt_path = models_dir / f"{model_name}.pt"
        meta_path = models_dir / f"{model_name}_meta.json"

        if not pt_path.exists():
            raise FileNotFoundError(f"Model weights not found: {pt_path}")
        if not meta_path.exists():
            raise FileNotFoundError(f"Model metadata not found: {meta_path}")

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        label_map: dict[str, int] = meta["label_map"]
        num_classes = meta["num_classes"]
        seq_len: int = meta.get("sequence_length", self._cfg.dataset.sequence_length)
        model_cfg_raw: dict = meta.get("model_config", {})

        model_cfg = ModelConfig(
            hidden_size=model_cfg_raw.get("hidden_size", self._cfg.model.hidden_size),
            num_layers=model_cfg_raw.get("num_layers", self._cfg.model.num_layers),
            bidirectional=model_cfg_raw.get("bidirectional", self._cfg.model.bidirectional),
            dropout=model_cfg_raw.get("dropout", self._cfg.model.dropout),
        )

        model = GestureLSTM.from_config(num_classes=num_classes, cfg=model_cfg)
        state_dict = torch.load(pt_path, map_location=self._device, weights_only=True)
        model.load_state_dict(state_dict)
        model.to(self._device)
        model.eval()

        self._model = model
        self._label_map = label_map
        self._idx_to_label = {v: k for k, v in label_map.items()}
        self._sequence_length = seq_len
        self._loaded_name = model_name

        logger.info(
            "Loaded model '%s' — %d classes, seq_len=%d, device=%s.",
            model_name,
            num_classes,
            seq_len,
            self._device,
        )

    def load_latest(self) -> bool:
        """Load the most recently created model from ``saved_models/``.

        Returns
        -------
        bool
            ``True`` if a model was found and loaded, ``False`` otherwise.
        """
        models_dir = self._cfg.paths.saved_models_path
        meta_files = sorted(models_dir.glob("*_meta.json"))
        if not meta_files:
            logger.info("No saved models found — predictor remains unloaded.")
            return False

        # Most recently created = largest timestamp in filename
        latest = meta_files[-1]
        model_name = latest.stem.replace("_meta", "")
        self.load(model_name)
        return True

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(
        self, sequence: np.ndarray
    ) -> tuple[str, float, dict[str, float]]:
        """Predict the gesture for a landmark sequence.

        Parameters
        ----------
        sequence:
            NumPy array of shape ``(seq_len, 63)``.

        Returns
        -------
        tuple
            ``(gesture_name, confidence, all_probabilities)``

        Raises
        ------
        RuntimeError
            If no model is loaded.
        """
        if self._model is None:
            raise RuntimeError("No model is loaded. Call `load()` first.")

        seq = self._prepare_sequence(sequence)
        x = torch.tensor(seq, dtype=torch.float32).unsqueeze(0).to(self._device)

        with torch.no_grad():
            probs = self._model.predict_proba(x)[0]  # (num_classes,)

        probs_np = probs.cpu().numpy()
        best_idx = int(np.argmax(probs_np))
        confidence = float(probs_np[best_idx])

        gesture_name = self._idx_to_label.get(best_idx, "unknown")
        all_probs = {
            self._idx_to_label.get(i, str(i)): float(p)
            for i, p in enumerate(probs_np)
        }

        if confidence < self._cfg.inference.confidence_threshold:
            gesture_name = "unknown"

        return gesture_name, confidence, all_probs

    def predict_from_list(
        self, sequence: list[list[float]]
    ) -> tuple[str, float, dict[str, float]]:
        """Convenience wrapper accepting a nested Python list.

        Parameters
        ----------
        sequence:
            ``list[list[float]]`` of shape ``(seq_len, 63)``.
        """
        arr = np.array(sequence, dtype=np.float32)
        return self.predict(arr)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _prepare_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """Pad or truncate *sequence* to match the model's expected length."""
        n = len(sequence)
        target = self._sequence_length
        if n >= target:
            return sequence[:target]
        pad = np.zeros((target - n, sequence.shape[1]), dtype=np.float32)
        return np.vstack([sequence, pad])

    @staticmethod
    def _resolve_device(preference: str) -> torch.device:
        if preference == "cuda":
            return torch.device("cuda")
        if preference == "cpu":
            return torch.device("cpu")
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

"""Model evaluation service.

Produces per-class metrics, a confusion matrix, and an overall accuracy /
macro-F1 summary against the full dataset (no train/val split applied).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from torch.utils.data import DataLoader

from app.models.lstm_model import GestureLSTM
from app.models.schemas import ClassMetrics, EvaluationResponse
from app.services.training.dataset_loader import GestureDataset
from app.utils.config import AppConfig, get_config

logger = logging.getLogger(__name__)


class EvaluationService:
    """Evaluates a trained GestureLSTM against the full dataset.

    Parameters
    ----------
    config:
        Application configuration.
    """

    def __init__(self, config: Optional[AppConfig] = None) -> None:
        self._cfg = config or get_config()
        self._device = self._resolve_device(self._cfg.inference.device)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate(
        self,
        model: GestureLSTM,
        label_map: dict[str, int],
        sequence_length: Optional[int] = None,
    ) -> EvaluationResponse:
        """Evaluate *model* on the full gesture dataset.

        Parameters
        ----------
        model:
            Trained model (already on correct device or CPU).
        label_map:
            ``{gesture_name: class_index}`` mapping used during training.
        sequence_length:
            Sequence length to use when loading CSVs.  Defaults to config.

        Returns
        -------
        EvaluationResponse
        """
        seq_len = sequence_length or self._cfg.dataset.sequence_length

        dataset = GestureDataset(
            datasets_dir=self._cfg.paths.datasets_path,
            sequence_length=seq_len,
            label_map=label_map,
        )
        loader = DataLoader(
            dataset,
            batch_size=self._cfg.training.batch_size,
            shuffle=False,
            num_workers=0,
        )

        all_preds, all_labels = self._collect_predictions(model, loader)

        num_classes = len(label_map)
        labels_range = list(range(num_classes))

        # Overall accuracy
        accuracy = float(
            sum(p == l for p, l in zip(all_preds, all_labels)) / max(len(all_labels), 1)
        )

        # Per-class precision / recall / F1
        precision_arr = precision_score(
            all_labels, all_preds, labels=labels_range, average=None, zero_division=0
        )
        recall_arr = recall_score(
            all_labels, all_preds, labels=labels_range, average=None, zero_division=0
        )
        f1_arr = f1_score(
            all_labels, all_preds, labels=labels_range, average=None, zero_division=0
        )
        macro_f1 = float(
            f1_score(all_labels, all_preds, average="macro", zero_division=0)
        )

        idx_to_label = {v: k for k, v in label_map.items()}
        per_class: dict[str, ClassMetrics] = {}
        for class_idx in labels_range:
            class_name = idx_to_label.get(class_idx, str(class_idx))
            support = int(sum(1 for l in all_labels if l == class_idx))
            per_class[class_name] = ClassMetrics(
                precision=float(precision_arr[class_idx]),
                recall=float(recall_arr[class_idx]),
                f1=float(f1_arr[class_idx]),
                support=support,
            )

        # Confusion matrix
        cm = confusion_matrix(all_labels, all_preds, labels=labels_range)

        logger.info(
            "Evaluation complete — accuracy: %.4f, macro_f1: %.4f",
            accuracy,
            macro_f1,
        )

        return EvaluationResponse(
            overall_accuracy=round(accuracy, 6),
            macro_f1=round(macro_f1, 6),
            per_class=per_class,
            confusion_matrix=cm.tolist(),
            label_map=label_map,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _collect_predictions(
        self,
        model: GestureLSTM,
        loader: DataLoader,
    ) -> tuple[list[int], list[int]]:
        model.to(self._device)
        model.eval()
        all_preds: list[int] = []
        all_labels: list[int] = []

        with torch.no_grad():
            for x, y in loader:
                x = x.to(self._device)
                logits = model(x)
                preds = logits.argmax(dim=-1).cpu().tolist()
                all_preds.extend(preds)
                all_labels.extend(y.tolist())

        return all_preds, all_labels

    @staticmethod
    def _resolve_device(preference: str) -> torch.device:
        if preference == "cuda":
            return torch.device("cuda")
        if preference == "cpu":
            return torch.device("cpu")
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

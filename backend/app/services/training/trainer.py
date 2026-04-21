"""Training pipeline for the GestureLSTM model."""
from __future__ import annotations

import csv
import json
import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from sklearn.metrics import f1_score, precision_score, recall_score
from torch.optim import Adam
from torch.utils.data import DataLoader

from app.models.lstm_model import GestureLSTM
from app.models.schemas import EpochMetrics, TrainRequest
from app.services.training.dataset_loader import build_dataloaders
from app.utils.config import AppConfig, ModelConfig, TrainingConfig, get_config

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    model_name: str
    model_path: str
    meta_path: str
    epochs_trained: int
    best_val_accuracy: float
    label_map: dict[str, int]
    history: list[EpochMetrics]


class TrainingService:
    """Orchestrates the full training workflow.

    Parameters
    ----------
    config:
        Application configuration.  Defaults to the global singleton.
    """

    def __init__(self, config: Optional[AppConfig] = None) -> None:
        self._cfg = config or get_config()
        self._device = self._resolve_device(self._cfg.inference.device)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def train(self, request: TrainRequest) -> TrainingResult:
        """Run a complete training job.

        Parameters
        ----------
        request:
            Training configuration (overrides from the API).

        Returns
        -------
        TrainingResult
        """
        # ---- Merge request overrides with config defaults ----
        model_cfg = ModelConfig(
            hidden_size=request.hidden_size or self._cfg.model.hidden_size,
            num_layers=request.num_layers or self._cfg.model.num_layers,
            bidirectional=(
                request.bidirectional
                if request.bidirectional is not None
                else self._cfg.model.bidirectional
            ),
            dropout=request.dropout if request.dropout is not None else self._cfg.model.dropout,
        )
        train_cfg = TrainingConfig(
            batch_size=request.batch_size or self._cfg.training.batch_size,
            learning_rate=request.learning_rate or self._cfg.training.learning_rate,
            epochs=request.epochs or self._cfg.training.epochs,
            early_stopping_patience=(
                request.early_stopping_patience
                if request.early_stopping_patience is not None
                else self._cfg.training.early_stopping_patience
            ),
            val_split=self._cfg.training.val_split,
            random_seed=self._cfg.training.random_seed,
        )
        seq_len = request.sequence_length or self._cfg.dataset.sequence_length

        # ---- Data ----
        train_loader, val_loader, label_map = build_dataloaders(
            config=self._cfg, sequence_length=seq_len
        )
        num_classes = len(label_map)

        # ---- Model ----
        model = GestureLSTM.from_config(num_classes=num_classes, cfg=model_cfg)
        model.to(self._device)

        optimizer = Adam(model.parameters(), lr=train_cfg.learning_rate)
        criterion = nn.CrossEntropyLoss()

        # ---- Training loop ----
        history: list[EpochMetrics] = []
        best_val_acc = 0.0
        best_state: Optional[dict] = None
        no_improve_count = 0

        log_rows: list[dict] = []

        for epoch in range(1, train_cfg.epochs + 1):
            train_loss, train_acc = self._run_epoch(
                model, train_loader, criterion, optimizer, training=True
            )
            val_loss, val_acc = self._run_epoch(
                model, val_loader, criterion, optimizer=None, training=False
            )

            metrics = EpochMetrics(
                epoch=epoch,
                train_loss=round(train_loss, 6),
                train_accuracy=round(train_acc, 6),
                val_loss=round(val_loss, 6),
                val_accuracy=round(val_acc, 6),
            )
            history.append(metrics)
            log_rows.append(asdict(metrics))

            logger.info(
                "Epoch %d/%d — train_loss: %.4f train_acc: %.4f "
                "val_loss: %.4f val_acc: %.4f",
                epoch,
                train_cfg.epochs,
                train_loss,
                train_acc,
                val_loss,
                val_acc,
            )

            # Track best
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                no_improve_count = 0
            else:
                no_improve_count += 1

            # Early stopping
            if (
                train_cfg.early_stopping_patience
                and no_improve_count >= train_cfg.early_stopping_patience
            ):
                logger.info(
                    "Early stopping at epoch %d (no improvement for %d epochs).",
                    epoch,
                    train_cfg.early_stopping_patience,
                )
                break

        # ---- Save checkpoint ----
        timestamp = int(time.time())
        model_filename = f"{request.model_name}_{timestamp}.pt"
        meta_filename = f"{request.model_name}_{timestamp}_meta.json"

        model_path = self._cfg.paths.saved_models_path / model_filename
        meta_path = self._cfg.paths.saved_models_path / meta_filename

        if best_state is not None:
            model.load_state_dict(best_state)

        torch.save(model.state_dict(), model_path)
        logger.info("Model saved to %s", model_path)

        meta = {
            "model_name": request.model_name,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp)),
            "num_classes": num_classes,
            "label_map": label_map,
            "sequence_length": seq_len,
            "model_config": {
                "hidden_size": model_cfg.hidden_size,
                "num_layers": model_cfg.num_layers,
                "bidirectional": model_cfg.bidirectional,
                "dropout": model_cfg.dropout,
            },
            "metrics": {
                "best_val_accuracy": round(best_val_acc, 6),
                "epochs_trained": len(history),
            },
        }
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

        # ---- Write CSV training log ----
        self._write_log(request.model_name, timestamp, log_rows)

        return TrainingResult(
            model_name=request.model_name,
            model_path=str(model_path),
            meta_path=str(meta_path),
            epochs_trained=len(history),
            best_val_accuracy=best_val_acc,
            label_map=label_map,
            history=history,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_epoch(
        self,
        model: GestureLSTM,
        loader: DataLoader,
        criterion: nn.Module,
        optimizer: Optional[torch.optim.Optimizer],
        training: bool,
    ) -> tuple[float, float]:
        model.train(training)
        total_loss = 0.0
        all_preds: list[int] = []
        all_labels: list[int] = []

        ctx = torch.enable_grad() if training else torch.no_grad()
        with ctx:
            for x, y in loader:
                x = x.to(self._device)
                y = y.to(self._device)

                logits = model(x)
                loss = criterion(logits, y)

                if training and optimizer is not None:
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

                total_loss += loss.item() * len(y)
                preds = logits.argmax(dim=-1).cpu().tolist()
                all_preds.extend(preds)
                all_labels.extend(y.cpu().tolist())

        avg_loss = total_loss / max(len(loader.dataset), 1)
        accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / max(len(all_labels), 1)
        return avg_loss, accuracy

    def _write_log(self, model_name: str, timestamp: int, rows: list[dict]) -> None:
        log_path = (
            self._cfg.paths.logs_path / f"{model_name}_{timestamp}_training.csv"
        )
        if not rows:
            return
        with log_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        logger.info("Training log saved to %s", log_path)

    @staticmethod
    def _resolve_device(preference: str) -> torch.device:
        if preference == "cuda":
            return torch.device("cuda")
        if preference == "cpu":
            return torch.device("cpu")
        # auto
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

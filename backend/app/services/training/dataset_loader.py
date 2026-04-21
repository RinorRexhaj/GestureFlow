"""Dataset loading utilities for the training pipeline.

Scans ``datasets/`` for gesture sub-directories, builds a label map, and
exposes PyTorch ``Dataset`` / ``DataLoader`` helpers.

Expected directory layout::

    datasets/
        swipe_left/
            sample_001.csv
            sample_002.csv
        swipe_right/
            sample_001.csv
        ...

Each CSV has ``sequence_length`` rows and 63 columns (no header expected, but
a header row is tolerated via ``pandas.read_csv``).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset, random_split

from app.utils.config import AppConfig, get_config

logger = logging.getLogger(__name__)


class GestureDataset(Dataset):
    """PyTorch Dataset over gesture CSV files.

    Parameters
    ----------
    datasets_dir:
        Root directory that contains one sub-folder per gesture class.
    sequence_length:
        Target sequence length.  CSVs with fewer rows are zero-padded;
        longer CSVs are truncated.
    label_map:
        Optional pre-built ``{gesture_name: class_index}`` mapping.
        If ``None``, one is derived from the alphabetically-sorted gesture
        directories found under ``datasets_dir``.
    """

    def __init__(
        self,
        datasets_dir: Path,
        sequence_length: int,
        label_map: Optional[dict[str, int]] = None,
    ) -> None:
        self.sequence_length = sequence_length
        self.samples: list[tuple[Path, int]] = []  # (csv_path, class_idx)

        gesture_dirs = sorted(
            d for d in datasets_dir.iterdir() if d.is_dir()
        )
        if not gesture_dirs:
            raise ValueError(f"No gesture sub-directories found in {datasets_dir}")

        if label_map is None:
            label_map = {d.name: idx for idx, d in enumerate(gesture_dirs)}

        self.label_map = label_map
        self.idx_to_label = {v: k for k, v in label_map.items()}

        for gesture_dir in gesture_dirs:
            class_name = gesture_dir.name
            if class_name not in self.label_map:
                logger.warning(
                    "Gesture '%s' not in label_map — skipping.", class_name
                )
                continue
            class_idx = self.label_map[class_name]
            csv_files = sorted(gesture_dir.glob("sample_*.csv"))
            for csv_path in csv_files:
                self.samples.append((csv_path, class_idx))

        if not self.samples:
            raise ValueError(
                f"No CSV samples found in gesture directories under {datasets_dir}"
            )

        logger.info(
            "GestureDataset: %d samples across %d classes.",
            len(self.samples),
            len(self.label_map),
        )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        csv_path, class_idx = self.samples[idx]
        sequence = self._load_csv(csv_path)
        x = torch.tensor(sequence, dtype=torch.float32)  # (seq_len, 63)
        y = torch.tensor(class_idx, dtype=torch.long)
        return x, y

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_csv(self, path: Path) -> np.ndarray:
        df = pd.read_csv(path, header=0)
        arr = df.values.astype(np.float32)  # (rows, 63)
        n = len(arr)
        if n >= self.sequence_length:
            return arr[: self.sequence_length]
        pad = np.zeros((self.sequence_length - n, arr.shape[1]), dtype=np.float32)
        return np.vstack([arr, pad])


# ---------------------------------------------------------------------------
# DataLoader factory
# ---------------------------------------------------------------------------


def build_dataloaders(
    config: Optional[AppConfig] = None,
    sequence_length: Optional[int] = None,
) -> tuple[DataLoader, DataLoader, dict[str, int]]:
    """Build train and validation ``DataLoader`` instances.

    Parameters
    ----------
    config:
        Application config.  Falls back to the global singleton.
    sequence_length:
        Override for ``config.dataset.sequence_length``.

    Returns
    -------
    tuple
        ``(train_loader, val_loader, label_map)``
    """
    cfg = config or get_config()
    seq_len = sequence_length or cfg.dataset.sequence_length

    dataset = GestureDataset(
        datasets_dir=cfg.paths.datasets_path,
        sequence_length=seq_len,
    )

    val_size = max(1, int(len(dataset) * cfg.training.val_split))
    train_size = len(dataset) - val_size

    generator = torch.Generator().manual_seed(cfg.training.random_seed)
    train_ds, val_ds = random_split(
        dataset, [train_size, val_size], generator=generator
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=cfg.training.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=False,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=cfg.training.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=False,
    )

    logger.info(
        "DataLoaders ready — train: %d samples, val: %d samples.",
        train_size,
        val_size,
    )
    return train_loader, val_loader, dataset.label_map

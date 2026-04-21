from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_ROOT = Path(__file__).resolve().parents[2]  # backend/
_DEFAULT_CONFIG = _ROOT / "config" / "default.yaml"


def _load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


# ---------------------------------------------------------------------------
# Nested config sections
# ---------------------------------------------------------------------------


class DatasetConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DATASET_")

    sequence_length: int = 32
    num_hands: int = 1
    recording_overlap: int = 0


class ModelConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MODEL_")

    hidden_size: int = 128
    num_layers: int = 2
    bidirectional: bool = False
    dropout: float = 0.3


class TrainingConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRAINING_")

    batch_size: int = 32
    learning_rate: float = 0.001
    epochs: int = 50
    val_split: float = 0.2
    early_stopping_patience: Optional[int] = 10
    random_seed: int = 42


class InferenceConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INFERENCE_")

    confidence_threshold: float = 0.6
    device: str = "auto"


class ServerConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SERVER_")

    host: str = "0.0.0.0"
    port: int = 8000
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


class PathsConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PATHS_")

    datasets_dir: str = "datasets"
    saved_models_dir: str = "saved_models"
    logs_dir: str = "logs"

    def resolve(self, base: Path = _ROOT) -> "PathsConfig":
        """Return a copy with all paths resolved relative to *base*."""
        return PathsConfig(
            datasets_dir=str(base / self.datasets_dir),
            saved_models_dir=str(base / self.saved_models_dir),
            logs_dir=str(base / self.logs_dir),
        )

    @property
    def datasets_path(self) -> Path:
        return Path(self.datasets_dir)

    @property
    def saved_models_path(self) -> Path:
        return Path(self.saved_models_dir)

    @property
    def logs_path(self) -> Path:
        return Path(self.logs_dir)


# ---------------------------------------------------------------------------
# Root settings assembled from YAML + env overrides
# ---------------------------------------------------------------------------


class AppConfig:
    """Aggregates all config sections.

    Priority (highest → lowest):
      1. Environment variables (per-section prefix, e.g. TRAINING_EPOCHS=100)
      2. GESTUREFLOW_CONFIG env var pointing to a YAML file
      3. config/default.yaml
    """

    def __init__(self) -> None:
        yaml_path = Path(os.environ.get("GESTUREFLOW_CONFIG", str(_DEFAULT_CONFIG)))
        raw: dict = _load_yaml(yaml_path) if yaml_path.exists() else {}

        self.dataset = DatasetConfig(**raw.get("dataset", {}))
        self.model = ModelConfig(**raw.get("model", {}))
        self.training = TrainingConfig(**raw.get("training", {}))
        self.inference = InferenceConfig(**raw.get("inference", {}))
        self.server = ServerConfig(**raw.get("server", {}))
        self.paths = PathsConfig(**raw.get("paths", {})).resolve(_ROOT)

    def ensure_dirs(self) -> None:
        """Create required directories if they do not exist."""
        for p in (
            self.paths.datasets_path,
            self.paths.saved_models_path,
            self.paths.logs_path,
        ):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    """Return a cached singleton AppConfig instance."""
    cfg = AppConfig()
    cfg.ensure_dirs()
    return cfg

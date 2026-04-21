"""Pydantic request / response schemas for all API endpoints."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


class TrainRequest(BaseModel):
    """Configuration overrides for a training run.

    All fields are optional — omitted fields fall back to config/default.yaml.
    """

    model_name: str = Field(
        "gesture_model",
        description="Logical name for the saved model artefact.",
    )
    hidden_size: Optional[int] = Field(None, gt=0)
    num_layers: Optional[int] = Field(None, gt=0)
    bidirectional: Optional[bool] = None
    dropout: Optional[float] = Field(None, ge=0.0, le=1.0)
    batch_size: Optional[int] = Field(None, gt=0)
    learning_rate: Optional[float] = Field(None, gt=0.0)
    epochs: Optional[int] = Field(None, gt=0)
    early_stopping_patience: Optional[int] = Field(None, gt=0)
    sequence_length: Optional[int] = Field(None, gt=0)


class EpochMetrics(BaseModel):
    epoch: int
    train_loss: float
    train_accuracy: float
    val_loss: float
    val_accuracy: float


class TrainResponse(BaseModel):
    model_name: str
    model_path: str
    epochs_trained: int
    best_val_accuracy: float
    label_map: dict[str, int]
    history: list[EpochMetrics]


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------


class PredictRequest(BaseModel):
    """Raw sequence passed as a nested list.

    Shape: (sequence_length, 63)  — landmark vectors per frame.
    """

    sequence: list[list[float]] = Field(
        ...,
        description="List of frames; each frame is a flat vector of 63 floats.",
    )
    model_name: Optional[str] = Field(
        None,
        description="Model to use. Falls back to the currently loaded model.",
    )


class PredictResponse(BaseModel):
    gesture: str
    confidence: float
    action: Optional[str] = None
    all_probabilities: dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------


class ModelInfo(BaseModel):
    name: str
    path: str
    created_at: str
    num_classes: int
    label_map: dict[str, int]
    metrics: Optional[dict[str, Any]] = None


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


class LoadModelRequest(BaseModel):
    model_name: str = Field(
        ...,
        description="Exact model name as returned by GET /models.",
    )


class LoadModelResponse(BaseModel):
    loaded: str
    num_classes: int
    label_map: dict[str, int]


# ---------------------------------------------------------------------------
# WebSocket messages
# ---------------------------------------------------------------------------


class WSClientMessage(BaseModel):
    """Message sent from the browser over the WebSocket.

    Supports two payload variants:
      - ``frame`` (base64-encoded JPEG/PNG): server extracts landmarks
      - ``landmarks`` (flat 63-float vector): server skips extraction step
    """

    session_id: str
    frame: Optional[str] = Field(None, description="Base64-encoded image frame.")
    landmarks: Optional[list[float]] = Field(
        None,
        description="Pre-extracted flat landmark vector (63 floats).",
    )


class WSServerMessage(BaseModel):
    gesture: Optional[str] = None
    confidence: Optional[float] = None
    action: Optional[str] = None
    buffer_fill: float = Field(0.0, ge=0.0, le=1.0)
    landmarks_detected: bool = False
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


class EvaluationRequest(BaseModel):
    model_name: Optional[str] = Field(
        None,
        description="Model to evaluate. Defaults to currently loaded model.",
    )
    sequence_length: Optional[int] = None


class ClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: int


class EvaluationResponse(BaseModel):
    overall_accuracy: float
    macro_f1: float
    per_class: dict[str, ClassMetrics]
    confusion_matrix: list[list[int]]
    label_map: dict[str, int]

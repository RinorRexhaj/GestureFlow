"""POST /predict — single-shot gesture prediction."""
from __future__ import annotations

import logging
from io import BytesIO

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import PredictRequest, PredictResponse
from app.services.inference.predictor import GesturePredictor
from app.utils.config import get_config
from app.utils.gesture_actions import get_action

router = APIRouter(prefix="/predict", tags=["Prediction"])
logger = logging.getLogger(__name__)

# Shared predictor injected by main.py at startup
_predictor: GesturePredictor | None = None


def set_predictor(predictor: GesturePredictor) -> None:
    global _predictor
    _predictor = predictor


def _get_predictor() -> GesturePredictor:
    if _predictor is None or not _predictor.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="No model is currently loaded. Use POST /load-model first.",
        )
    return _predictor


@router.post(
    "",
    response_model=PredictResponse,
    summary="Predict gesture from a landmark sequence (JSON)",
)
async def predict_json(request: PredictRequest) -> PredictResponse:
    """Predict gesture from a raw JSON landmark sequence.

    The ``sequence`` field must be a list of frames where each frame is a
    list of 63 floats (flattened 21-landmark × 3-coordinate vector).
    """
    predictor = _get_predictor()

    try:
        gesture, confidence, all_probs = predictor.predict_from_list(request.sequence)
    except Exception as exc:
        logger.exception("Prediction failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    action = get_action(gesture) if gesture != "unknown" else None
    return PredictResponse(
        gesture=gesture,
        confidence=confidence,
        action=action,
        all_probabilities=all_probs,
    )


@router.post(
    "/csv",
    response_model=PredictResponse,
    summary="Predict gesture from an uploaded CSV file",
)
async def predict_csv(file: UploadFile = File(...)) -> PredictResponse:
    """Predict gesture from an uploaded CSV sequence file.

    The CSV must have the same format as those produced by the dataset
    recorder: rows = frames, columns = 63 landmark values.  A single header
    row is accepted and automatically skipped.
    """
    predictor = _get_predictor()

    try:
        contents = await file.read()
        df = pd.read_csv(BytesIO(contents), header=0)
        sequence = df.values.astype(np.float32)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Failed to parse CSV: {exc}"
        ) from exc

    if sequence.shape[1] != 63:
        raise HTTPException(
            status_code=422,
            detail=f"CSV must have exactly 63 columns, found {sequence.shape[1]}.",
        )

    try:
        gesture, confidence, all_probs = predictor.predict(sequence)
    except Exception as exc:
        logger.exception("Prediction failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    action = get_action(gesture) if gesture != "unknown" else None
    return PredictResponse(
        gesture=gesture,
        confidence=confidence,
        action=action,
        all_probabilities=all_probs,
    )

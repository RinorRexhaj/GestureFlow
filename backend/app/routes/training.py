"""POST /train — trigger a model training job."""
from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException

from app.models.schemas import EvaluationRequest, EvaluationResponse, TrainRequest, TrainResponse
from app.services.training.evaluator import EvaluationService
from app.services.training.trainer import TrainingService
from app.utils.config import get_config

router = APIRouter(prefix="/train", tags=["Training"])
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="trainer")


@router.post("", response_model=TrainResponse, summary="Train a new gesture model")
async def train(request: TrainRequest) -> TrainResponse:
    """Train an LSTM model on the gesture dataset.

    The training job is executed in a background thread so the event loop
    remains responsive.  Only one concurrent training job is allowed; a
    second request while training is in progress will queue behind the first.

    Returns the training result including per-epoch history and model path.
    """
    try:
        service = TrainingService(config=get_config())
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            _executor, lambda: service.train(request)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Training failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Training error: {exc}") from exc

    return TrainResponse(
        model_name=result.model_name,
        model_path=result.model_path,
        epochs_trained=result.epochs_trained,
        best_val_accuracy=result.best_val_accuracy,
        label_map=result.label_map,
        history=result.history,
    )


@router.post(
    "/evaluate",
    response_model=EvaluationResponse,
    summary="Evaluate a loaded model",
)
async def evaluate(request: EvaluationRequest) -> EvaluationResponse:
    """Evaluate the specified (or currently loaded) model on the full dataset.

    Returns per-class precision / recall / F1, overall accuracy, macro-F1,
    and the raw confusion matrix.
    """
    from app.services.inference.predictor import GesturePredictor
    from app.models.lstm_model import GestureLSTM
    import json

    cfg = get_config()
    predictor = GesturePredictor(config=cfg)

    try:
        if request.model_name:
            predictor.load(request.model_name)
        else:
            loaded = predictor.load_latest()
            if not loaded:
                raise HTTPException(
                    status_code=404,
                    detail="No trained models found.  Train a model first.",
                )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if predictor._model is None:
        raise HTTPException(status_code=500, detail="Model failed to load.")

    try:
        service = EvaluationService(config=cfg)
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            _executor,
            lambda: service.evaluate(
                model=predictor._model,
                label_map=predictor.label_map,
                sequence_length=request.sequence_length,
            ),
        )
    except Exception as exc:
        logger.exception("Evaluation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Evaluation error: {exc}") from exc

    return result

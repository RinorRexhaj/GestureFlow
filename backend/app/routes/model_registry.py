"""GET /models · POST /load-model — model registry endpoints."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.models.schemas import LoadModelRequest, LoadModelResponse, ModelInfo, ModelsResponse
from app.services.inference.predictor import GesturePredictor
from app.utils.config import get_config

router = APIRouter(tags=["Model Registry"])
logger = logging.getLogger(__name__)

_predictor: GesturePredictor | None = None


def set_predictor(predictor: GesturePredictor) -> None:
    global _predictor
    _predictor = predictor


@router.get("/models", response_model=ModelsResponse, summary="List saved models")
async def list_models() -> ModelsResponse:
    """Return all models available in ``saved_models/``.

    Each entry includes the label map, creation timestamp, class count,
    and any evaluation metrics stored in the metadata file.
    """
    cfg = get_config()
    models_dir = cfg.paths.saved_models_path
    meta_files = sorted(models_dir.glob("*_meta.json"))

    items: list[ModelInfo] = []
    for meta_path in meta_files:
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            pt_name = meta_path.stem.replace("_meta", "")
            items.append(
                ModelInfo(
                    name=pt_name,
                    path=str(models_dir / f"{pt_name}.pt"),
                    created_at=meta.get("created_at", "unknown"),
                    num_classes=meta.get("num_classes", 0),
                    label_map=meta.get("label_map", {}),
                    metrics=meta.get("metrics"),
                )
            )
        except Exception as exc:
            logger.warning("Failed to read model metadata %s: %s", meta_path, exc)

    return ModelsResponse(models=items)


@router.post(
    "/load-model",
    response_model=LoadModelResponse,
    summary="Load a model into the inference predictor",
)
async def load_model(request: LoadModelRequest) -> LoadModelResponse:
    """Load the specified model by name.

    After this call, the loaded model will be used for all subsequent
    ``POST /predict`` and ``WS /stream`` requests.

    The ``model_name`` must match an entry from ``GET /models``.
    """
    if _predictor is None:
        raise HTTPException(status_code=500, detail="Predictor not initialised.")

    try:
        _predictor.load(request.model_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to load model '%s': %s", request.model_name, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return LoadModelResponse(
        loaded=request.model_name,
        num_classes=_predictor.num_classes,
        label_map=_predictor.label_map,
    )

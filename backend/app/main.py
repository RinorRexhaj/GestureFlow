"""GestureFlow backend — FastAPI application entry point.

Start the server from the ``backend/`` directory::

    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

The lifespan handler:
  1. Ensures required directories exist.
  2. Instantiates a shared ``GesturePredictor``.
  3. Attempts to auto-load the most recently trained model.
  4. Wires the predictor into routes and the WebSocket connection manager.
  5. Cleans up resources on shutdown.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import model_registry, prediction, training, websocket
from app.services.inference.predictor import GesturePredictor
from app.services.websocket.stream_handler import ConnectionManager
from app.utils.config import get_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    cfg = get_config()
    logger.info("GestureFlow backend starting up.")
    logger.info("Datasets dir : %s", cfg.paths.datasets_path)
    logger.info("Models dir   : %s", cfg.paths.saved_models_path)
    logger.info("Logs dir     : %s", cfg.paths.logs_path)

    # ---- Initialise shared predictor ----
    predictor = GesturePredictor(config=cfg)
    loaded = predictor.load_latest()
    if loaded:
        logger.info("Auto-loaded model: %s", predictor.loaded_name)
    else:
        logger.info("No pre-trained model found — predictor is idle.")

    # ---- Wire predictor into routes ----
    prediction.set_predictor(predictor)
    model_registry.set_predictor(predictor)

    # ---- Initialise WebSocket connection manager ----
    manager = ConnectionManager(predictor=predictor, config=cfg)
    websocket.set_manager(manager)

    yield

    # ---- Shutdown ----
    manager.cleanup()
    logger.info("GestureFlow backend shut down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    cfg = get_config()

    app = FastAPI(
        title="GestureFlow",
        description=(
            "Real-time hand gesture recognition backend — MediaPipe + LSTM.\n\n"
            "Supports dataset creation, LSTM training, evaluation, and live "
            "WebSocket inference for controlling browser actions."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    # ---- CORS ----
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.server.origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Routers ----
    app.include_router(training.router)
    app.include_router(prediction.router)
    app.include_router(model_registry.router)
    app.include_router(websocket.router)

    @app.get("/health", tags=["Health"])
    async def health() -> dict:
        """Liveness probe."""
        return {"status": "ok"}

    return app


app = create_app()

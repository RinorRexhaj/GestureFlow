from __future__ import annotations

import argparse
import sys
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.services.inference.predictor import GesturePredictor
from app.services.mediapipe.landmark_extractor import HandLandmarkExtractor
from app.utils.config import get_config


def _frame_has_signal(frame: np.ndarray) -> bool:
	if frame is None or frame.size == 0:
		return False
	mean_value = float(frame.mean())
	std_value = float(frame.std())
	return mean_value > 8.0 and std_value > 3.0


def _backend_from_name(name: str) -> tuple[str, int]:
	backend_map = {
		"any": ("Default", cv2.CAP_ANY),
		"auto": ("Default", cv2.CAP_ANY),
		"dshow": ("DirectShow", cv2.CAP_DSHOW),
		"msmf": ("MSMF", cv2.CAP_MSMF),
	}
	try:
		return backend_map[name.lower()]
	except KeyError as exc:
		raise ValueError(f"Unsupported backend: {name}") from exc


def _get_backend_candidates(selected_backend: str) -> list[tuple[str, int]]:
	if selected_backend != "auto":
		return [_backend_from_name(selected_backend)]

	backends: list[tuple[str, int]] = []
	if sys.platform.startswith("win"):
		backends.extend([
			("DirectShow", cv2.CAP_DSHOW),
			("MSMF", cv2.CAP_MSMF),
		])
	backends.append(("Default", cv2.CAP_ANY))
	return backends


def _open_camera(camera_index: int, selected_backend: str) -> tuple[cv2.VideoCapture, str]:
	for backend_name, backend in _get_backend_candidates(selected_backend):
		cap = cv2.VideoCapture(camera_index, backend)
		if not cap.isOpened():
			cap.release()
			continue

		cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
		cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
		cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

		for _ in range(30):
			ok, frame = cap.read()
			if ok and frame is not None and _frame_has_signal(frame):
				print(f"Camera opened with backend: {backend_name}")
				return cap, backend_name
			time.sleep(0.05)

		cap.release()

	raise RuntimeError(
		f"Could not open camera index {camera_index} with a working backend."
	)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Run live webcam gesture prediction with on-screen labels."
	)
	parser.add_argument(
		"--camera-index",
		type=int,
		default=0,
		help="OpenCV camera index to use.",
	)
	parser.add_argument(
		"--model-name",
		type=str,
		default=None,
		help="Specific saved model name to load. Defaults to the latest model.",
	)
	parser.add_argument(
		"--show-probabilities",
		action="store_true",
		help="Display the top class probabilities on screen.",
	)
	parser.add_argument(
		"--backend",
		type=str,
		default="auto",
		choices=["auto", "any", "dshow", "msmf"],
		help="Camera backend to use. 'auto' tries working backends in order.",
	)
	return parser.parse_args()


def _draw_status_panel(
	frame: np.ndarray,
	gesture: str,
	confidence: float,
	model_name: str,
	sequence_progress: int,
	sequence_length: int,
	top_scores: list[tuple[str, float]],
	status_message: str,
) -> np.ndarray:
	annotated = frame.copy()

	cv2.rectangle(annotated, (12, 12), (460, 180), (18, 18, 18), -1)
	cv2.rectangle(annotated, (12, 12), (460, 180), (80, 180, 80), 2)

	lines = [
		f"Model: {model_name}",
		f"Gesture: {gesture}",
		f"Confidence: {confidence:.2f}",
		f"Sequence: {sequence_progress}/{sequence_length}",
		"Press q to quit",
	]

	for index, line in enumerate(lines):
		cv2.putText(
			annotated,
			line,
			(24, 42 + (index * 26)),
			cv2.FONT_HERSHEY_SIMPLEX,
			0.68,
			(235, 245, 235),
			2,
			cv2.LINE_AA,
		)

	score_y = 210
	for label, score in top_scores:
		cv2.putText(
			annotated,
			f"{label}: {score:.2f}",
			(24, score_y),
			cv2.FONT_HERSHEY_SIMPLEX,
			0.58,
			(220, 220, 220),
			1,
			cv2.LINE_AA,
		)
		score_y += 22

	cv2.putText(
		annotated,
		status_message,
		(24, max(240, score_y + 8)),
		cv2.FONT_HERSHEY_SIMPLEX,
		0.7,
		(0, 220, 220),
		2,
		cv2.LINE_AA,
	)

	return annotated


def main() -> int:
	args = parse_args()
	cfg = get_config()

	predictor = GesturePredictor(config=cfg)
	if args.model_name:
		predictor.load(args.model_name)
	elif not predictor.load_latest():
		print("No saved model found in saved_models/. Train or load a model first.")
		return 1

	extractor = HandLandmarkExtractor(
		num_hands=cfg.dataset.num_hands,
		min_detection_confidence=0.7,
		min_tracking_confidence=0.5,
	)

	try:
		cap, backend_name = _open_camera(args.camera_index, args.backend)
	except (RuntimeError, ValueError) as exc:
		print(str(exc))
		extractor.close()
		return 1

	sequence_length = cfg.dataset.sequence_length
	sequence_buffer: deque[np.ndarray] = deque(maxlen=sequence_length)
	last_gesture = "waiting"
	last_confidence = 0.0
	last_scores: list[tuple[str, float]] = []
	status_message = f"Backend: {backend_name}"

	window_name = "GestureFlow Prediction Test"
	cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
	cv2.resizeWindow(window_name, 1280, 720)

	try:
		missed_frames = 0
		while True:
			ok, frame = cap.read()
			if not ok or frame is None:
				missed_frames += 1
				if missed_frames > 30:
					print("Failed to read frames from the camera consistently.")
					return 1
				continue

			if not _frame_has_signal(frame):
				missed_frames += 1
				status_message = "Camera stream is blank; retrying frames"
				if missed_frames > 30:
					print(
						"Camera is returning blank frames. Try --backend dshow or another --camera-index."
					)
					return 1
				continue

			missed_frames = 0
			landmarks = extractor.extract_from_frame(frame)
			if landmarks is not None:
				sequence_buffer.append(landmarks)
				status_message = "Hand detected"
			else:
				status_message = f"Backend: {backend_name} | No hand detected"

			annotated = extractor.draw_landmarks(frame)

			if len(sequence_buffer) == sequence_length:
				gesture, confidence, all_probs = predictor.predict(
					np.array(sequence_buffer, dtype=np.float32)
				)
				last_gesture = gesture
				last_confidence = confidence
				if args.show_probabilities:
					last_scores = sorted(
						all_probs.items(),
						key=lambda item: item[1],
						reverse=True,
					)[:3]
				else:
					last_scores = []

			overlay = _draw_status_panel(
				annotated,
				last_gesture,
				last_confidence,
				f"{predictor.loaded_name or 'unknown'} [{backend_name}]",
				len(sequence_buffer),
				sequence_length,
				last_scores,
				status_message,
			)

			cv2.imshow(window_name, overlay)
			key = cv2.waitKey(1) & 0xFF
			if key == ord("q"):
				break
	finally:
		cap.release()
		extractor.close()
		cv2.destroyAllWindows()

	return 0


if __name__ == "__main__":
	raise SystemExit(main())

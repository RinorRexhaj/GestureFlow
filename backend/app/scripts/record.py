import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

import cv2

# Quick camera check
print("Checking camera...")
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: Cannot open camera index 0.")
    sys.exit(1)
ret, frame = cap.read()
cap.release()
if not ret or frame is None:
    print("ERROR: Camera opened but could not read a frame.")
    sys.exit(1)
print(f"Camera OK — frame shape: {frame.shape}")

print("Waiting 1s before reopening camera...")
time.sleep(1)

print("Importing MediaPipe...")
import mediapipe as mp
print("MediaPipe imported.")

print("Initialising MediaPipe Hands model (may take a few seconds on first run)...")
hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=1)
print("MediaPipe Hands ready.")
hands.close()

print("Reopening camera...")
cap2 = cv2.VideoCapture(0)
if not cap2.isOpened():
    print("ERROR: Could not reopen camera.")
    sys.exit(1)
print("Warming up camera (10 frames)...")
for i in range(10):
    cap2.read()
    print(f"  warm-up frame {i+1}/10")
cap2.release()
print("Camera warm-up done.")

print("\nAll checks passed — starting recorder.\n")

from app.services.dataset.recorder import DatasetRecorder

gesture = "swipe_right"   # <-- change this for each gesture

r = DatasetRecorder()
saved = r.record_from_webcam(
    gesture_name=gesture,
    num_samples=15,
    sequence_length=32,
    countdown_seconds=1,
    camera_index=0,
)

print(f"\nDone. Saved {len(saved)} samples:")
for p in saved:
    print(f"  {p}")
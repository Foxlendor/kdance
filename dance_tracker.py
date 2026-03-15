import cv2
import time
import math
from collections import deque
from ultralytics import YOLO
from dotenv import load_dotenv
load_dotenv(override=True)

from audio_crossfader import AudioCrossfader

class MovementState:
    def __init__(self):
        self.last_time = time.time()
        self.last_x, self.last_y = None, None
        self.last_vx, self.last_vy = 0.0, 0.0
        self.last_ax, self.last_ay = 0.0, 0.0

    def update(self, x, y):
        current_time = time.time()
        dt = max(current_time - self.last_time, 0.001)
        metrics = {"speed": 0.0, "acceleration": 0.0, "jerk": 0.0, "vy": 0.0, "ay": 0.0}

        if self.last_x is not None and self.last_y is not None:
            vx, vy = (x - self.last_x) / dt, (y - self.last_y) / dt
            metrics["speed"] = math.sqrt(vx**2 + vy**2)
            metrics["vy"] = vy
            
            ax, ay = (vx - self.last_vx) / dt, (vy - self.last_vy) / dt
            metrics["acceleration"] = math.sqrt(ax**2 + ay**2)
            metrics["ay"] = ay
            
            jx, jy = (ax - self.last_ax) / dt, (ay - self.last_ay) / dt
            metrics["jerk"] = math.sqrt(jx**2 + jy**2)

            self.last_vx, self.last_vy, self.last_ax, self.last_ay = vx, vy, ax, ay

        self.last_x, self.last_y, self.last_time = x, y, current_time
        return metrics

import threading

class ThreadedCamera:
    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src)
        self.ret, self.frame = self.cap.read()
        self.stopped = False
        if self.cap.isOpened():
            self.thread = threading.Thread(target=self.update, args=())
            self.thread.daemon = True
            self.thread.start()

    def update(self):
        while not self.stopped:
            if not self.cap.isOpened():
                self.stopped = True
            else:
                self.ret, self.frame = self.cap.read()

    def read(self):
        return self.ret, self.frame

    def isOpened(self):
        return self.cap.isOpened()

    def set(self, propId, value):
        return self.cap.set(propId, value)
        
    def get(self, propId):
        return self.cap.get(propId)

    def release(self):
        self.stopped = True
        if hasattr(self, 'thread') and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        self.cap.release()

def main():
    print("Loading YOLOv8 Pose model...")
    from ultralytics import YOLO
    model = YOLO('yolov8n-pose.pt') 

    smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_smile.xml')

    video_path = "my_dance_video.mp4" 
    cap = ThreadedCamera(video_path)
    
    if not cap.isOpened():
        print(f"Warning: Could not open {video_path}. Falling back to webcam...")
        cap = ThreadedCamera(0)

    trackers = {
        "core": MovementState(),
        "left_wrist": MovementState(),
        "right_wrist": MovementState(),
        "left_ankle": MovementState(),
        "right_ankle": MovementState(),
        "nose": MovementState()
    }
    
    crossfader = AudioCrossfader(fade_duration_ms=2000)

    # Rolling buffer for 60 frames (~2 seconds at 30fps)
    pose_buffer = deque(maxlen=60)

    try:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                # Loop video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Added half=True for FP16 inference and explicitly set imgsz=320 for stable real-time tracking
            results = model.track(frame, persist=True, classes=[0], conf=0.5, imgsz=320, verbose=False, half=True)
            
            annotated_frame = frame.copy()
            
            core_speed = 0
            avg_wrist_jerk = 0
            stomp = False
            arm_spread = 0.0
            verticality = 1.0
            headbang = 0.0
            is_smiling = False
            snare = False
            hihat = False
            is_airborne = False

            if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                
                if len(keypoints) >= 17:
                    # Append to rolling buffer
                    pose_buffer.append(keypoints.copy())

                    # If buffer is full, send it to crossfader
                    if len(pose_buffer) == 60:
                        crossfader.update_pose_buffer(pose_buffer)
                        pose_buffer.clear() # clear after sending to wait for the next 60 frames

                    l_hip = keypoints[11]
                    r_hip = keypoints[12]
                    
                    if l_hip[0] != 0 and r_hip[0] != 0:
                        core_x = int((l_hip[0] + r_hip[0]) / 2)
                        core_y = int((l_hip[1] + r_hip[1]) / 2)
                        core_metrics = trackers["core"].update(core_x, core_y)
                        core_speed = core_metrics["speed"]
                        verticality = max(0.0, min(1.0, 1.0 - (core_y / frame.shape[0])))
                        cv2.circle(annotated_frame, (core_x, core_y), 10, (0, 255, 0), -1)

                    l_wrist = keypoints[9]
                    r_wrist = keypoints[10]
                    
                    l_wrist_metrics = trackers["left_wrist"].update(l_wrist[0], l_wrist[1])
                    r_wrist_metrics = trackers["right_wrist"].update(r_wrist[0], r_wrist[1])
                    
                    avg_wrist_jerk = (l_wrist_metrics["jerk"] + r_wrist_metrics["jerk"]) / 2
                    
                    if l_wrist_metrics["jerk"] > 3000 and l_wrist_metrics["vy"] > 100:
                        snare = True
                    if r_wrist_metrics["jerk"] > 2000 and r_wrist_metrics["vy"] > 100:
                        hihat = True
                    
                    if l_wrist[0] != 0 and r_wrist[0] != 0:
                        dist = math.sqrt((l_wrist[0] - r_wrist[0])**2 + (l_wrist[1] - r_wrist[1])**2)
                        arm_spread = max(0.0, min(1.0, dist / 400.0))
                    
                    if l_wrist[0] != 0: cv2.circle(annotated_frame, (int(l_wrist[0]), int(l_wrist[1])), 8, (255, 255, 0), -1)
                    if r_wrist[0] != 0: cv2.circle(annotated_frame, (int(r_wrist[0]), int(r_wrist[1])), 8, (255, 255, 0), -1)

                    nose = keypoints[0]
                    l_eye = keypoints[1]
                    r_eye = keypoints[2]
                    nm = trackers["nose"].update(nose[0], nose[1])
                    headbang = abs(nm["ay"])
                    if nose[0] != 0:
                        cv2.circle(annotated_frame, (int(nose[0]), int(nose[1])), 6, (255, 0, 255), -1)
                        if l_eye[0] != 0 and r_eye[0] != 0:
                            eye_dist = abs(l_eye[0] - r_eye[0])
                            if eye_dist > 10:
                                face_x = int(nose[0] - eye_dist * 2)
                                face_y = int(nose[1] - eye_dist * 1.5)
                                face_w = int(eye_dist * 4)
                                face_h = int(eye_dist * 4)
                                if face_x > 0 and face_y > 0 and face_x + face_w < frame.shape[1] and face_y + face_h < frame.shape[0]:
                                    roi_gray = cv2.cvtColor(frame[face_y:face_y+face_h, face_x:face_x+face_w], cv2.COLOR_BGR2GRAY)
                                    smiles = smile_cascade.detectMultiScale(roi_gray, scaleFactor=1.8, minNeighbors=20)
                                    if len(smiles) > 0:
                                        is_smiling = True
                                        cv2.putText(annotated_frame, ":D", (int(nose[0]), int(nose[1]-20)), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)


                    l_ankle = keypoints[15]
                    r_ankle = keypoints[16]
                    l_ankle_metrics = trackers["left_ankle"].update(l_ankle[0], l_ankle[1])
                    r_ankle_metrics = trackers["right_ankle"].update(r_ankle[0], r_ankle[1])
                    
                    if l_ankle[0] != 0:
                        cv2.circle(annotated_frame, (int(l_ankle[0]), int(l_ankle[1])), 8, (0, 165, 255), -1)
                        if l_ankle_metrics["vy"] > 200 and l_ankle_metrics["ay"] < -5000:
                            stomp = True
                    if r_ankle[0] != 0:
                        cv2.circle(annotated_frame, (int(r_ankle[0]), int(r_ankle[1])), 8, (0, 165, 255), -1)
                        if r_ankle_metrics["vy"] > 200 and r_ankle_metrics["ay"] < -5000:
                            stomp = True
                    
                    if l_ankle_metrics["vy"] < -300 and r_ankle_metrics["vy"] < -300:
                        is_airborne = True
                        
            # Keep physics for silence fade-out and active triggers
            crossfader.update_dancer_state(core_speed, avg_wrist_jerk, stomp, snare, hihat, is_smiling, is_airborne, arm_spread, verticality, headbang)

            cv2.imshow("Everlock Neural Engine - Choreographic Vision", annotated_frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
                
    except KeyboardInterrupt:
        pass
    finally:
        print("Cleaning up...")
        cap.release()
        cv2.destroyAllWindows()
        crossfader.stop()

if __name__ == "__main__":
    main()
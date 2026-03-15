import os
import sys
import json
import yt_dlp
import librosa
import numpy as np
import cv2
from moviepy import VideoFileClip
from collections import deque
from ultralytics import YOLO

def download_video(query, download_dir="dataset", max_downloads=1):
    """Search and download a dance video from YouTube."""
    os.makedirs(download_dir, exist_ok=True)
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': f'{download_dir}/%(id)s.%(ext)s',
        'noplaylist': True,
        'quiet': False
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        if query.startswith('http'):
            info = ydl.extract_info(query, download=True)
        else:
            info = ydl.extract_info(f"ytsearch{max_downloads}:{query}", download=True)
            if 'entries' in info and len(info['entries']) > 0:
                info = info['entries'][0]
                
    video_path = os.path.join(download_dir, f"{info['id']}.mp4")
    return video_path, info

def extract_music_features(video_path):
    """Extract tempo, beats, and energy curve from video audio."""
    print("Extracting audio features...")
    # Extract audio using moviepy
    clip = VideoFileClip(video_path)
    audio_path = video_path.replace('.mp4', '.wav')
    clip.audio.write_audiofile(audio_path, logger=None)
    clip.close()

    # Load audio with librosa
    y, sr = librosa.load(audio_path, sr=22050)
    
    # Calculate tempo and beats
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    
    # Calculate energy curve (RMS)
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
    
    # Clean up audio file
    if os.path.exists(audio_path):
        os.remove(audio_path)
        
    return {
        "tempo": float(tempo[0] if isinstance(tempo, np.ndarray) else tempo),
        "beats": beat_times.tolist(),
        "energy_curve": {
            "times": rms_times.tolist(),
            "values": rms.tolist()
        }
    }

def process_motion(video_path):
    """Run YOLOv8-pose on video to extract kinematics."""
    print("Extracting motion features...")
    model = YOLO('yolov8n-pose.pt')
    cap = cv2.VideoCapture(video_path)
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 30
    
    motion_events = []
    frame_idx = 0
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        time_ms = (frame_idx / fps) * 1000
        frame_idx += 1
        
        # We only process every 3rd frame to save time
        if frame_idx % 3 != 0:
            continue
            
        results = model(frame, verbose=False)
        
        if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
            kp = results[0].keypoints.xy[0].cpu().numpy()
            
            if len(kp) >= 17:
                # Basic representation of the frame
                motion_events.append({
                    "time_ms": float(time_ms),
                    "core": {"x": float((kp[11][0] + kp[12][0])/2), "y": float((kp[11][1] + kp[12][1])/2)},
                    "l_wrist": {"x": float(kp[9][0]), "y": float(kp[9][1])},
                    "r_wrist": {"x": float(kp[10][0]), "y": float(kp[10][1])},
                    "l_ankle": {"x": float(kp[15][0]), "y": float(kp[15][1])},
                    "r_ankle": {"x": float(kp[16][0]), "y": float(kp[16][1])}
                })
                
    cap.release()
    return motion_events

def build_dataset(query, style_label):
    video_path, info = download_video(query)
    if not os.path.exists(video_path):
        print(f"Failed to download video for query: {query}")
        return
        
    print(f"Downloaded: {info['title']}")
    
    music_features = extract_music_features(video_path)
    motion_events = process_motion(video_path)
    
    dataset_entry = {
        "metadata": {
            "id": info['id'],
            "title": info['title'],
            "style": style_label,
            "source": info['webpage_url']
        },
        "music_features": music_features,
        "motion_events": motion_events
    }
    
    output_path = f"dataset/{info['id']}_data.json"
    with open(output_path, 'w') as f:
        json.dump(dataset_entry, f)
        
    print(f"Successfully processed and saved to {output_path}!")

if __name__ == "__main__":
    queries = [
        ("house dance shuffle tutorial", "House Shuffle"),
        ("liquid drum and bass dance", "Liquid DnB"),
        ("dubstep popping and locking", "Dubstep Popping"),
        ("808 dark boom bap type beat dance", "Dark 808 Boom Bap"),
        ("lofi hip hop type beat dance", "Lofi"),
        ("travis scott type beat dance", "Trap"),
        ("drill type beat dance", "Drill"),
        ("phonk type beat dance", "Phonk"),
        ("90s boom bap type beat dance", "Boom Bap"),
        ("j dilla type beat dance", "Soulful Hip Hop"),
        ("kanye west type beat dance", "Gospel Hip Hop"),
        ("drake type beat dance", "Melodic Trap"),
        ("future type beat dance", "Dark Trap"),
        ("playboi carti type beat dance", "Rage"),
        ("metro boomin type beat dance", "Cinematic Trap")
    ]
    
    for q, style in queries:
        print(f"--- Processing {style} ---")
        try:
            # Check if we already have data for this style
            # This is a bit rough since we don't know the ID yet, 
            # but we can check the dataset folder for the style label in metadata if we wanted to be precise.
            # For now, let's just run it.
            build_dataset(q, style)
        except Exception as e:
            print(f"Error processing {q}: {e}")

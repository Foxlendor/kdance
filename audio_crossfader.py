import asyncio
import threading
import time
import os
import queue
import json
import numpy as np
import sounddevice as sd
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(override=True)

class AudioCrossfader:
    def __init__(self, fade_duration_ms=3000):
        self.lock = threading.Lock()
        
        self.pose_buffer = None
        self.new_buffer_available = False
        
        self.target_volume = 1.0
        self.current_volume = 1.0
        self.last_active_time = time.time()
        
        self.is_running = True
        
        # Drum synth and effects state
        self.is_airborne = False
        self.is_smiling = False
        self.drum_queue = queue.Queue()
        self.drum_mix_buffer = np.zeros((48000 * 2, 2), dtype=np.float32)
        self.audio_history = np.zeros((48000, 2), dtype=np.float32)
        
        self.kick_snd = self._generate_kick()
        self.snare_snd = self._generate_snare()
        self.hihat_snd = self._generate_hihat()
        
        # Debounce tracking
        self.last_stomp = False
        self.last_snare = False
        self.last_hihat = False
        
        self.api_key = os.environ.get("GEMINI_API_KEY")
        print("GEMINI_API_KEY present?", bool(self.api_key))
        if not self.api_key:
            print("[Lyria] WARNING: No GEMINI_API_KEY environment variable found!")
            
        self.audio_q = queue.Queue()
        self.playback_thread = threading.Thread(target=self._audio_player_loop, daemon=True)
        self.playback_thread.start()
            
        self.audio_thread = threading.Thread(target=self._run_async_loop, daemon=True)
        self.audio_thread.start()

    def _generate_kick(self):
        fs = 48000
        t = np.linspace(0, 0.2, int(0.2*fs), False)
        freq = np.linspace(150, 40, len(t))
        env = np.exp(-t * 20)
        kick = np.sin(2 * np.pi * freq * t) * env
        # boost volume and duplicate channels
        return np.column_stack((kick, kick)).astype(np.float32) * 20000.0

    def _generate_snare(self):
        fs = 48000
        t = np.linspace(0, 0.15, int(0.15*fs), False)
        env = np.exp(-t * 30)
        noise = np.random.normal(0, 1, len(t)) * env
        tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t * 50)
        snare = noise + tone
        return np.column_stack((snare, snare)).astype(np.float32) * 15000.0

    def _generate_hihat(self):
        fs = 48000
        t = np.linspace(0, 0.05, int(0.05*fs), False)
        env = np.exp(-t * 100)
        noise = np.random.normal(0, 1, len(t))
        noise[1:] = np.diff(noise) # Highpass approximation
        hihat = noise * env
        return np.column_stack((hihat, hihat)).astype(np.float32) * 10000.0

    def update_dancer_state(self, core_speed, wrist_jerk, stomp, snare=False, hihat=False, is_smiling=False, is_airborne=False, arm_spread=0.0, verticality=1.0, headbang=0.0):
        with self.lock:
            # Drum Triggers
            if stomp and not self.last_stomp:
                self.drum_queue.put(self.kick_snd)
            if snare and not self.last_snare:
                self.drum_queue.put(self.snare_snd)
            if hihat and not self.last_hihat:
                self.drum_queue.put(self.hihat_snd)
                
            self.last_stomp = stomp
            self.last_snare = snare
            self.last_hihat = hihat
            self.is_smiling = is_smiling
            self.is_airborne = is_airborne
            
            # Require significant movement to stay active (ignores small jitter)
            is_active = core_speed > 60 or wrist_jerk > 4000 or headbang > 3000

            
            if is_active:
                self.last_active_time = time.time()
                
            # Fade out if the dancer does little to nothing for 1 second
            if time.time() - getattr(self, "last_active_time", time.time()) > 1.0:
                self.target_volume = 0.0
            else:
                self.target_volume = 1.0

    def update_pose_buffer(self, pose_buffer):
        """Called by dance_tracker.py when 60 frames of keypoints are ready."""
        with self.lock:
            self.pose_buffer = list(pose_buffer) # Copy the deque
            self.new_buffer_available = True

    def _audio_player_loop(self):
        try:
            with sd.RawOutputStream(samplerate=48000, channels=2, dtype='int16') as stream:
                while self.is_running:
                    try:
                        data = self.audio_q.get(timeout=1.0)
                        if data is None:
                            break
                        
                        # Apply volume fade out / in logic
                        tv = self.target_volume
                        cv = self.current_volume
                        frames = len(data) // 4  # 16-bit 2-channel = 4 bytes per frame
                        
                        audio_data = np.frombuffer(data, dtype=np.int16).reshape(-1, 2).astype(np.float32)
                        if cv != tv:
                            step = 1.0 / (48000.0 * 2.0)
                            if cv > tv:
                                end_v = max(tv, cv - step * frames)
                            else:
                                end_v = min(tv, cv + step * frames)
                                
                            vol_curve = np.linspace(cv, end_v, frames).reshape(-1, 1)
                            self.current_volume = end_v
                            audio_data = audio_data * vol_curve
                        else:
                            if cv < 1.0:
                                audio_data = audio_data * cv
                                
                        # Apply drum mixes
                        while not self.drum_queue.empty():
                            try:
                                snd = self.drum_queue.get_nowait()
                                n = min(len(snd), len(self.drum_mix_buffer))
                                self.drum_mix_buffer[:n] += snd[:n]
                            except queue.Empty:
                                break
                        
                        audio_data += self.drum_mix_buffer[:frames]
                        self.drum_mix_buffer = np.roll(self.drum_mix_buffer, -frames, axis=0)
                        self.drum_mix_buffer[-frames:] = 0.0

                        # Apply DSP Reverb (Airborne)
                        if getattr(self, "is_airborne", False):
                            delay_frames = int(48000 * 0.3) # 300ms reverb throw
                            delayed_audio = self.audio_history[-delay_frames:-delay_frames+frames]
                            if len(delayed_audio) == frames:
                                audio_data += delayed_audio * 0.7
                                
                        self.audio_history = np.roll(self.audio_history, -frames, axis=0)
                        self.audio_history[-frames:] = audio_data
                        
                        # Clip audio to prevent distortion
                        np.clip(audio_data, -32768, 32767, out=audio_data)
                        
                        data = audio_data.astype(np.int16).tobytes()
                        stream.write(data)
                    except queue.Empty:
                        continue
        except Exception as e:
            print(f"[Audio Player] Error starting audio stream: {e}")

    def _run_async_loop(self):
        asyncio.run(self._music_loop())

    async def _receive_audio(self, session):
        try:
            async for msg in session.receive():
                if not self.is_running:
                    break
                if msg.server_content and msg.server_content.audio_chunks:
                    for chunk in msg.server_content.audio_chunks:
                        if chunk.data:
                            self.audio_q.put(chunk.data)
        except Exception as e:
            if self.is_running:
                print(f"[Lyria] Error receiving audio stream: {e}")

    async def _classify_dance_style(self, pose_buffer, client):
        """Passes 2 seconds of pose data to Gemini 2.5 Flash for choreographic classification."""
        try:
            # We can simplify the buffer to avoid passing too much data.
            # pose_buffer is a list of 60 frames, each containing 17 keypoints (x, y).
            # Convert to a condensed string representation.
            condensed_buffer = []
            # We can just sample every 3rd frame to save context
            for i in range(0, len(pose_buffer), 3):
                frame = pose_buffer[i]
                condensed_buffer.append({
                    "core_y": float(frame[11][1]) if frame[11][0] != 0 else 0.0, # Left hip Y
                    "l_wrist": [float(frame[9][0]), float(frame[9][1])] if frame[9][0] != 0 else [0.0,0.0],
                    "r_wrist": [float(frame[10][0]), float(frame[10][1])] if frame[10][0] != 0 else [0.0,0.0]
                })

            prompt = f"""
You are a professional choreographer AI. Analyze this 2-second sequence of skeletal joint data (sampled every 3 frames).
Data format: core_y (hip height), l_wrist (x,y), r_wrist (x,y).
Classify the sequence into a specific street dance or K-pop style (e.g. Tutting, House Shuffling, Body Rolling, Krumping, etc.).

Return ONLY a valid JSON object matching this schema:
{{
  "detected_style": "Name of the dance style",
  "lyria_music_prompt": "Highly detailed, genre-specific text prompt for an AI music generator that matches this dance style's culture and rhythm.",
  "lyrics": "1-2 short, catchy lines of lyrics that fit the vibe and energy of this dance style.",
  "bpm": 120
}}

Pose Data:
{json.dumps(condensed_buffer)}
"""
            # Using flash model
            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            result = json.loads(response.text)
            return result
        except Exception as e:
            print(f"[Gemini Classifier] Error: {e}")
            return None

    async def _music_loop(self):
        if not self.api_key:
            print("[Lyria] No API Key.")
            return

        client = genai.Client(
            api_key=self.api_key,
            http_options={"api_version": "v1alpha"},
        )
        
        try:
            print("[Lyria] Connecting to Lyria RealTime (models/lyria-realtime-exp)...")
            async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as session:
                print("[Lyria] Connected successfully! Initializing continuous music generation...")
                
                receive_task = asyncio.create_task(self._receive_audio(session))
                
                # Default start
                current_vibe = "atmospheric liquid drum and bass, smooth rolling bassline, chill ethereal vibes"
                current_bpm = 170
                
                await session.set_weighted_prompts([
                    types.WeightedPrompt(text=current_vibe, weight=1.0)
                ])
                await session.set_music_generation_config(
                    types.LiveMusicGenerationConfig(bpm=current_bpm, temperature=1.0)
                )
                
                print(f"[Lyria] Starting live playback: {current_vibe}")
                await session.play()
                
                # The "Magic" Loop
                while self.is_running:
                    buffer_to_process = None
                    with self.lock:
                        if self.new_buffer_available and self.pose_buffer:
                            buffer_to_process = self.pose_buffer
                            self.new_buffer_available = False
                    
                    if buffer_to_process:
                        print(f"[Choreographer] Analyzing 60-frame buffer...")
                        classification = await self._classify_dance_style(buffer_to_process, client)
                        
                        if classification:
                            new_vibe = classification.get("lyria_music_prompt", current_vibe)
                            new_lyrics = classification.get("lyrics", "")
                            new_bpm = classification.get("bpm", current_bpm)
                            detected_style = classification.get("detected_style", "Unknown")
                            
                            # Combine prompt with lyrics
                            full_vibe_prompt = new_vibe
                            if new_lyrics:
                                full_vibe_prompt += f" Female/Male vocal singing: '{new_lyrics}'"
                                
                            with self.lock:
                                smiling = self.is_smiling
                                
                            if smiling:
                                full_vibe_prompt += ", happy, upbeat, bright, major key"
                            else:
                                full_vibe_prompt += ", dark, moody, serious, minor key"
                            
                            if full_vibe_prompt != current_vibe:
                                print(f"[Choreographer] Detected Style: {detected_style}")
                                print(f"[Choreographer] Generated Lyrics: {new_lyrics}")
                                print(f"[Lyria] Updating prompt: {full_vibe_prompt} ({new_bpm} BPM)")
                                
                                await session.set_weighted_prompts([
                                    types.WeightedPrompt(text=full_vibe_prompt, weight=1.0)
                                ])
                                await session.set_music_generation_config(
                                    types.LiveMusicGenerationConfig(bpm=new_bpm, temperature=1.3)
                                )
                                current_vibe = full_vibe_prompt
                                current_bpm = new_bpm

                    await asyncio.sleep(0.1)
                    
                receive_task.cancel()
                    
        except Exception as e:
            print(f"[Lyria] Connection Error: {e}")

    def stop(self):
        self.is_running = False
        self.audio_q.put(None)
        self.audio_thread.join()
        self.playback_thread.join()
        print("Music crossfader stopped.")

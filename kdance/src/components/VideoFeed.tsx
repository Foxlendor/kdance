import React, { useEffect, useRef, useState } from 'react';
import { poseService } from '../services/poseService';
import { motionDetector } from '../services/motionDetector';
import { musicEngine } from '../services/musicEngine';
import { musicPlanner } from '../services/musicPlanner';
import { spotifyService } from '../services/spotifyService';
import type { MotionEvent } from '../types';
import { Camera, Upload, Activity, Play, Pause, Square } from 'lucide-react';

interface VideoFeedProps {
  stylePreset: string;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({ stylePreset }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const requestRef = useRef<number>(null);

  // Rolling window of recent events for the planner
  const recentEvents = useRef<MotionEvent[]>([]);
  const lastPlanTime = useRef<number>(0);

  const startCamera = async () => {
    try {
      await poseService.initialize();
      await musicEngine.initialize();
      musicEngine.start();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 360, facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
        // Kick off the loop directly here in case useEffect is delayed
        requestRef.current = requestAnimationFrame(processFrame);
      }
    } catch (e) {
      console.error(e);
      alert('Could not start camera.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await poseService.initialize();
      await musicEngine.initialize();
      musicEngine.start();

      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        setMode('upload');
        await videoRef.current.play();
        setIsActive(true);
        setIsPaused(false);
        requestRef.current = requestAnimationFrame(processFrame);
      }
    }
  };

  const togglePause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const stopVideo = () => {
    setIsActive(false);
    setIsPaused(false);
    if (videoRef.current) {
      videoRef.current.pause();
      if (mode === 'camera' && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      } else {
        videoRef.current.src = '';
      }
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isActive) {
      if (isActive) requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (videoRef.current.paused || videoRef.current.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
        // 1. Pose Extraction (Limit frequency to reduce lag if needed, but here we try per frame)
        const poses = await poseService.estimatePose(videoRef.current);
        
        // 2. Motion Analysis -> Events
        const now = performance.now();
        const newEvents = motionDetector.update(poses, now, 0);
        
        // Calculate average intensity for real-time dynamism
        let currentFrameIntensity = 0;
        if (newEvents.length > 0) {
          setEvents(prev => [...newEvents, ...prev].slice(0, 10));
          
          recentEvents.current = [...recentEvents.current, ...newEvents].filter(e => now - e.time < 5000);
          
          currentFrameIntensity = newEvents.reduce((sum, e) => sum + e.intensity, 0) / newEvents.length;
          
          // 3. Trigger immediate reactions
          newEvents.forEach(e => musicEngine.handleEvent(e));
        }

        // Always update intensity for smooth dynamism
        musicEngine.updateIntensity(currentFrameIntensity > 0 ? currentFrameIntensity : (recentEvents.current.length / 20));
        
        // 4. Update Planner periodically (every 5 seconds) instead of randomly
        if (now - lastPlanTime.current > 5000) {
          lastPlanTime.current = now;
          musicPlanner.plan(recentEvents.current, 120, stylePreset).then(plan => {
            musicEngine.executePlan(plan);
            
            // Spotify integration
            if (plan.spotifyQuery) {
              spotifyService.searchAndPlay(plan.spotifyQuery);
            }
          });
        }

        // Drawing (Only if canvas exists)
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const { clientWidth, clientHeight } = videoRef.current;
          if (canvasRef.current.width !== clientWidth || canvasRef.current.height !== clientHeight) {
            canvasRef.current.width = clientWidth;
            canvasRef.current.height = clientHeight;
          }
          
          ctx.clearRect(0, 0, clientWidth, clientHeight);
          
          const scaleX = clientWidth / videoRef.current.videoWidth;
          const scaleY = clientHeight / videoRef.current.videoHeight;

          if (poses.length > 0) {
            poses[0].keypoints.forEach(kp => {
              if (kp.score && kp.score > 0.3) {
                ctx.beginPath();
                ctx.arc(kp.x * scaleX, kp.y * scaleY, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#dc2626';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.stroke();
              }
            });
          }
        }
    } catch (e) {
        console.error("Error in processFrame", e);
    }

    if (isActive) {
        requestRef.current = requestAnimationFrame(processFrame);
    }
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive]);

  return (
    <div className="w-full space-y-4">
      <div className="relative aspect-video bg-gray-900 border-4 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
            <Activity size={48} className="mb-4 opacity-50" />
            <p className="font-bold tracking-widest uppercase">Waiting for Video Source</p>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={startCamera}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white font-bold uppercase tracking-wider border-2 border-black hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]"
        >
          <Camera size={18} /> Live Camera
        </button>
        <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black font-bold uppercase tracking-wider border-2 border-black hover:bg-gray-50 transition-colors cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Upload size={18} /> Upload Video
          <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
      
      <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-40 overflow-y-auto">
        <h3 className="text-xs font-black uppercase tracking-widest text-black/50 mb-2 border-b-2 border-gray-100 pb-2">Event Log</h3>
        {events.map((e, i) => (
          <div key={i} className="text-sm font-mono">
            <span className="text-red-600 font-bold">[{e.type.toUpperCase()}]</span> 
            {' '}Body: {e.bodyPart} | Intensity: {e.intensity.toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  );
};

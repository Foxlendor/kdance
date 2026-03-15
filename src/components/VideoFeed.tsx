import React, { useEffect, useRef, useState, useCallback } from 'react';
import { poseService } from '../services/poseService';
import { motionDetector } from '../services/motionDetector';
import { musicEngine } from '../services/musicEngine';
import { musicPlanner } from '../services/musicPlanner';
import { spotifyService } from '../services/spotifyService';
import type { MotionEvent } from '../types';
import { Camera, Upload, Play, Pause, Square, Zap } from 'lucide-react';

// MoveNet skeleton connections (17-point model)
const SKELETON_CONNECTIONS = [
  [5, 6],   // shoulders
  [5, 7],   // left shoulder -> elbow
  [7, 9],   // left elbow -> wrist
  [6, 8],   // right shoulder -> elbow
  [8, 10],  // right elbow -> wrist
  [5, 11],  // left shoulder -> hip
  [6, 12],  // right shoulder -> hip
  [11, 12], // hips
  [11, 13], // left hip -> knee
  [13, 15], // left knee -> ankle
  [12, 14], // right hip -> knee
  [14, 16], // right knee -> ankle
  [0, 5],   // nose -> left shoulder (approx)
  [0, 6],   // nose -> right shoulder (approx)
];

interface VideoFeedProps {
  stylePreset: string;
  audioMode?: 'spotify' | 'generative';
  onSessionStart?: () => void;
  onSessionStop?: () => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({ 
  stylePreset, audioMode = 'generative', onSessionStart, onSessionStop 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [flashEvent, setFlashEvent] = useState<string | null>(null);
  const requestRef = useRef<number>(null);
  const isActiveRef = useRef(false);

  const recentEvents = useRef<MotionEvent[]>([]);
  const lastPlanTime = useRef<number>(0);

  // Keep isActiveRef in sync with isActive
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const drawSkeleton = useCallback((
    ctx: CanvasRenderingContext2D, 
    keypoints: any[], 
    scaleX: number, 
    scaleY: number,
    energy: number
  ) => {
    // Dynamic color based on energy
    const hue = 260 - energy * 200; // purple (260) at low, red (60) at high
    const baseColor = `hsla(${hue}, 85%, 60%, 0.9)`;
    const glowColor = `hsla(${hue}, 85%, 60%, 0.3)`;
    
    // Draw connections (skeleton lines)
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    // Glow effect at high energy
    if (energy > 0.5) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = energy * 15;
    }
    
    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const a = keypoints[i];
      const b = keypoints[j];
      if (a?.score > 0.25 && b?.score > 0.25) {
        ctx.beginPath();
        ctx.moveTo(a.x * scaleX, a.y * scaleY);
        ctx.lineTo(b.x * scaleX, b.y * scaleY);
        ctx.stroke();
      }
    });
    
    // Draw keypoints
    keypoints.forEach((kp: any, idx: number) => {
      if (kp.score && kp.score > 0.25) {
        const x = kp.x * scaleX;
        const y = kp.y * scaleY;
        const radius = idx === 0 ? 6 : 4; // Bigger for nose
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
        ctx.fillStyle = glowColor;
        ctx.fill();
        
        // Core dot
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = baseColor;
        ctx.fill();
        
        // White center
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      }
    });
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }, []);

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
        isActiveRef.current = true;
        setMode('camera');
        onSessionStart?.();
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
        isActiveRef.current = true;
        setIsPaused(false);
        onSessionStart?.();
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
    isActiveRef.current = false;
    setIsPaused(false);
    onSessionStop?.();
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
    musicEngine.stop();
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isActiveRef.current) {
      if (isActiveRef.current) requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (videoRef.current.paused || videoRef.current.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const poses = await poseService.estimatePose(videoRef.current);
      const now = performance.now();
      const newEvents = motionDetector.update(poses, now, 0);
      
      let currentFrameIntensity = 0;
      if (newEvents.length > 0) {
        setEvents(prev => [...newEvents, ...prev].slice(0, 15));
        recentEvents.current = [...recentEvents.current, ...newEvents].filter(e => now - e.time < 5000);
        currentFrameIntensity = newEvents.reduce((sum, e) => sum + e.intensity, 0) / newEvents.length;
        
        // Flash the most recent event type
        setFlashEvent(newEvents[0].type);
        setTimeout(() => setFlashEvent(null), 300);
        
        newEvents.forEach(e => musicEngine.handleEvent(e));
      }

      musicEngine.updateIntensity(currentFrameIntensity > 0 ? currentFrameIntensity : (recentEvents.current.length / 20));
      
      // Update planner every 5 seconds
      if (now - lastPlanTime.current > 5000) {
        lastPlanTime.current = now;
        musicPlanner.plan(recentEvents.current, 120, stylePreset).then(plan => {
          musicEngine.executePlan(plan);
          if (plan.spotifyQuery && audioMode === 'spotify') {
            spotifyService.searchAndPlay(plan.spotifyQuery);
          }
        });
      }

      // Drawing
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

        if (poses.length > 0 && poses[0].keypoints) {
          drawSkeleton(ctx, poses[0].keypoints, scaleX, scaleY, motionDetector.smoothedEnergy);
        }
      }
    } catch (e) {
      console.error("Error in processFrame", e);
    }

    if (isActiveRef.current) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const getMoveColor = (type: string) => {
    const colors: Record<string, string> = {
      hit: '#ef4444', step: '#f97316', wave: '#06b6d4', tutting: '#a855f7',
      footwork: '#22c55e', armRaise: '#6366f1', drop: '#dc2626', jump: '#eab308',
      bodyRoll: '#ec4899', isolation: '#8b5cf6', pop: '#f43f5e', spin: '#0ea5e9', freeze: '#94a3b8',
    };
    return colors[type] || '#6b7280';
  };

  return (
    <div className="w-full space-y-3">
      {/* Video container */}
      <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden border border-white/[0.06]">
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
        
        {/* Event flash overlay */}
        {flashEvent && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <div 
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse backdrop-blur-md"
              style={{ 
                background: `${getMoveColor(flashEvent)}30`,
                color: getMoveColor(flashEvent),
                border: `1px solid ${getMoveColor(flashEvent)}40`
              }}
            >
              <Zap size={10} className="inline mr-1" />
              {flashEvent}
            </div>
          </div>
        )}
        
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Camera size={28} className="text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/40">Start camera or upload a video</p>
          </div>
        )}
        
        {/* Inline controls when active */}
        {isActive && (
          <div className="absolute bottom-3 right-3 flex gap-2 z-10">
            {mode === 'upload' && (
              <button
                onClick={togglePause}
                className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <button
              onClick={stopVideo}
              className="w-8 h-8 rounded-lg bg-red-500/20 backdrop-blur-md border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-all"
            >
              <Square size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Start buttons (only when not active) */}
      {!isActive && (
        <div className="flex gap-3">
          <button
            onClick={startCamera}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-all border border-white/[0.06]"
          >
            <Camera size={16} /> Live Camera
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer border border-white/[0.06]">
            <Upload size={16} /> Upload Video
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}
      
      {/* Event Log */}
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 max-h-32 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em] mb-2">Event Log</p>
        {events.length === 0 && (
          <p className="text-xs text-white/15 italic">No events yet</p>
        )}
        {events.map((e, i) => (
          <div key={i} className="text-xs font-mono flex items-center gap-2 py-0.5">
            <span 
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: getMoveColor(e.type) }}
            />
            <span className="font-semibold uppercase" style={{ color: getMoveColor(e.type) }}>
              {e.type}
            </span>
            <span className="text-white/20">{e.bodyPart}</span>
            <span className="text-white/30 ml-auto tabular-nums">{e.intensity.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

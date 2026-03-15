"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { VideoFeed } from './VideoFeed';
import { SpotifyController } from './SpotifyController';
import { dataIngester } from '../services/dataIngester';
import { musicEngine } from '../services/musicEngine';
import { musicPlanner } from '../services/musicPlanner';
import { spotifyService } from '../services/spotifyService';
import { motionDetector } from '../services/motionDetector';
import SignoutButton from './SignoutButton';
import type { DanceStats } from '../types';

interface KdanceDashboardProps {
  accessToken: string;
}

const STYLE_OPTIONS = [
  { value: 'House Shuffle', label: 'House Shuffle', color: '#6366f1' },
  { value: 'Alien Trap', label: 'Alien Trap', color: '#a855f7' },
  { value: 'Chill Wave', label: 'Chill Wave', color: '#06b6d4' },
  { value: 'Rap Cypher', label: 'Rap Cypher', color: '#ef4444' },
  { value: 'Dark 808 Boom Bap', label: 'Dark 808', color: '#1e1b4b' },
  { value: 'Lofi', label: 'Lofi', color: '#d97706' },
  { value: 'Trap', label: 'Trap', color: '#dc2626' },
  { value: 'Drill', label: 'Drill', color: '#475569' },
  { value: 'Phonk', label: 'Phonk', color: '#be185d' },
  { value: 'Liquid DnB', label: 'Liquid DnB', color: '#0ea5e9' },
];

export default function KdanceDashboard({ accessToken }: KdanceDashboardProps) {
  const [stylePreset, setStylePreset] = useState('House Shuffle');
  const [audioMode, setAudioMode] = useState<'spotify' | 'generative'>('generative');
  const [stats, setStats] = useState<DanceStats>({
    energy: 0, bpm: 120, movesDetected: 0, currentMove: 'idle', sessionDuration: 0, peakEnergy: 0
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const sessionStartRef = useRef<number>(0);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    dataIngester.bootstrap();
  }, []);

  useEffect(() => {
    if (audioMode === 'spotify') {
      musicEngine.setMute(true);
    } else {
      musicEngine.setMute(false);
      spotifyService.pause();
    }
  }, [audioMode]);

  // Poll motion detector for stats
  useEffect(() => {
    if (isSessionActive) {
      sessionStartRef.current = Date.now();
      statsIntervalRef.current = setInterval(() => {
        setStats({
          energy: Math.round(motionDetector.smoothedEnergy * 100),
          bpm: 120, // Will be dynamic with transport
          movesDetected: motionDetector.moveCount,
          currentMove: motionDetector.lastMoveName,
          sessionDuration: Math.round((Date.now() - sessionStartRef.current) / 1000),
          peakEnergy: Math.round(motionDetector.peakEnergy * 100),
        });
      }, 100);
    } else {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    }
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [isSessionActive]);

  const handleStyleChange = useCallback((newStyle: string) => {
    setStylePreset(newStyle);
    musicEngine.setStyle(newStyle);
    musicPlanner.plan([], 120, newStyle).then(plan => {
      if (plan.spotifyQuery && audioMode === 'spotify') {
        spotifyService.searchAndPlay(plan.spotifyQuery, true);
      }
    });
  }, [audioMode]);

  const handleSessionStart = useCallback(() => {
    setIsSessionActive(true);
  }, []);

  const handleSessionStop = useCallback(() => {
    setIsSessionActive(false);
    setStats(s => ({ ...s, energy: 0, currentMove: 'idle' }));
  }, []);

  const currentStyleColor = STYLE_OPTIONS.find(s => s.value === stylePreset)?.color || '#6366f1';

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between backdrop-blur-md bg-black/40 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: currentStyleColor }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">K.DANCE</h1>
            <p className="text-[10px] text-white/40 tracking-[0.2em] uppercase font-medium">Motion-to-Music Engine</p>
          </div>
        </div>
        
        <div className="flex gap-3 items-center">
          {/* Audio mode toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5 text-xs font-semibold">
            <button 
              onClick={() => setAudioMode('generative')}
              className={`px-3 py-1.5 rounded-md transition-all ${audioMode === 'generative' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              AI Audio
            </button>
            <button 
              onClick={() => setAudioMode('spotify')}
              className={`px-3 py-1.5 rounded-md transition-all ${audioMode === 'spotify' ? 'bg-green-500/20 text-green-400' : 'text-white/40 hover:text-white/60'}`}
            >
              Spotify
            </button>
          </div>
          <SignoutButton />
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Video + Controls */}
          <div className="lg:col-span-8 space-y-4">
            <VideoFeed 
              stylePreset={stylePreset} 
              audioMode={audioMode}
              onSessionStart={handleSessionStart}
              onSessionStop={handleSessionStop}
            />
            
            {/* Style Selector */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-3">Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map(style => (
                  <button
                    key={style.value}
                    onClick={() => handleStyleChange(style.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      stylePreset === style.value 
                        ? 'text-white shadow-lg scale-105' 
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                    }`}
                    style={stylePreset === style.value ? { 
                      background: `${style.color}cc`,
                      boxShadow: `0 0 20px ${style.color}40`
                    } : {}}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Stats + Spotify + Mixer */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Real-time Stats */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em]">Live Stats</p>
                {isSessionActive && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: currentStyleColor }} />
                    <span className="text-[10px] text-white/40 font-mono">{formatDuration(stats.sessionDuration)}</span>
                  </div>
                )}
              </div>
              
              {/* Energy Meter */}
              <div className="mb-5">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-white/50 font-medium">Energy</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: currentStyleColor }}>{stats.energy}</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-150 ease-out"
                    style={{ 
                      width: `${stats.energy}%`,
                      background: `linear-gradient(90deg, ${currentStyleColor}80, ${currentStyleColor})`,
                      boxShadow: stats.energy > 60 ? `0 0 12px ${currentStyleColor}60` : 'none'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/20">Chill</span>
                  <span className="text-[10px] text-white/20">Peak: {stats.peakEnergy}</span>
                  <span className="text-[10px] text-white/20">Fire</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Current Move</p>
                  <p className="text-sm font-bold capitalize" style={{ color: stats.currentMove !== 'idle' ? currentStyleColor : 'rgba(255,255,255,0.3)' }}>
                    {stats.currentMove}
                  </p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Moves</p>
                  <p className="text-sm font-bold tabular-nums">{stats.movesDetected}</p>
                </div>
              </div>
            </div>

            {/* Spotify Controller */}
            <SpotifyController accessToken={accessToken} />

            {/* Live Mixer */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4">Mixer</p>
              <MixerChannels intensity={stats.energy / 100} color={currentStyleColor} />
            </div>

            {/* Engine State */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-3">Engine</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Style</span>
                  <span className="text-xs font-semibold" style={{ color: currentStyleColor }}>{stylePreset}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Audio</span>
                  <span className="text-xs font-semibold">{audioMode === 'generative' ? 'AI Synth' : 'Spotify'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Status</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isSessionActive ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                    <span className="text-xs font-semibold">{isSessionActive ? 'Active' : 'Idle'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Animated mixer channel bars */
function MixerChannels({ intensity, color }: { intensity: number; color: string }) {
  const channels = [
    { name: 'Drums', base: 0.6 },
    { name: 'Bass', base: 0.5 },
    { name: 'Chords', base: 0.4 },
    { name: 'FX', base: 0.3 },
  ];

  return (
    <div className="space-y-3">
      {channels.map(ch => {
        const level = Math.min(ch.base + intensity * 0.4 + Math.random() * 0.05, 1);
        return (
          <div key={ch.name} className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">{ch.name}</span>
              <span className="text-[10px] text-white/20 tabular-nums">{Math.round(level * 100)}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-200"
                style={{ 
                  width: `${level * 100}%`,
                  background: `linear-gradient(90deg, ${color}60, ${color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

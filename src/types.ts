// Core Event Schema
export interface MotionEvent {
  time: number;           // Unix timestamp (ms)
  beatIndex: number;      // Current beat relative to the playing track
  type: 'step' | 'hit' | 'wave' | 'jump' | 'spin' | 'freeze' | 'tutting' | 'footwork' | 'bodyRoll' | 'armRaise' | 'drop' | 'isolation' | 'pop';
  bodyPart: 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'core' | 'fullBody' | 'head';
  intensity: number;      // 0.0 to 1.0 (how hard/fast)
  direction?: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward';
  duration?: number;      // Optional: duration in ms for continuous moves like waves
}

// Database Entities
export interface DanceSession {
  id?: string;
  timestamp: number;
  style: string;
  bpm: number;
  mood: string;
  source: 'webcam' | 'video';
}

export interface MotionEventRow extends MotionEvent {
  id?: number;
  danceId: string;
}

export interface MusicFeatureRow {
  id?: number;
  danceId: string;
  tempo: number;
  energyCurve: number[];  // Reduced representation of energy over time
}

// Music Engine Types
export interface MusicPlan {
  drumPattern: string;    // E.g., 'four-on-the-floor', 'trap-halftime'
  bassRhythm: string;     // E.g., 'syncopated', 'steady-eighths'
  chordVoicing: string;   // E.g., 'open', 'closed', 'arpeggiated'
  fxAutomation: {
    filterCutoff: number; // 0.0 to 1.0
    reverbMix: number;    // 0.0 to 1.0
    delayMix?: number;    // 0.0 to 1.0
    distortion?: number;  // 0.0 to 1.0
  };
  spotifyQuery?: string;  // Optional search query for Spotify
  bpmTarget?: number;     // Target BPM from planner
}

export interface StylePreset {
  name: string;
  description: string;
  baseBpm: number;
  drumKits: string[];
  mappingRules: {
    hit: string;
    wave: string;
    jump: string;
  };
}

// Real-time stats for UI display
export interface DanceStats {
  energy: number;         // 0-100
  bpm: number;
  movesDetected: number;
  currentMove: string;
  sessionDuration: number; // seconds
  peakEnergy: number;
}

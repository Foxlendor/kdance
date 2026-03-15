// Core Event Schema
export interface MotionEvent {
  time: number;           // Unix timestamp (ms)
  beatIndex: number;      // Current beat relative to the playing track
  type: 'step' | 'hit' | 'wave' | 'jump' | 'spin' | 'freeze' | 'tutting' | 'footwork';
  bodyPart: 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'core' | 'fullBody';
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
  // Add other parsed features/MIDI dumps if needed
}

// Music Engine Types
export interface MusicPlan {
  drumPattern: string;    // E.g., 'four-on-the-floor', 'trap-halftime'
  bassRhythm: string;     // E.g., 'syncopated', 'steady-eighths'
  chordVoicing: string;   // E.g., 'open', 'closed', 'arpeggiated'
  fxAutomation: {
    filterCutoff: number; // 0.0 to 1.0
    reverbMix: number;    // 0.0 to 1.0
  };
  spotifyQuery?: string;  // Optional search query for Spotify
}

export interface StylePreset {
  name: string;
  description: string;
  baseBpm: number;
  drumKits: string[];
  mappingRules: {
    hit: string;          // what happens on a 'hit' (e.g., 'trigger_snare')
    wave: string;         // what happens on a 'wave' (e.g., 'open_filter')
    jump: string;         // 'trigger_crash_and_bass_drop'
  };
}

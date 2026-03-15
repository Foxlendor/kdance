import Dexie, { type Table } from 'dexie';
import type { DanceSession, MotionEventRow, MusicFeatureRow } from '../types';

export interface RawFrameRow {
  id?: number;
  danceId: string;
  timeMs: number;
  core: { x: number; y: number };
  lWrist: { x: number; y: number };
  rWrist: { x: number; y: number };
  lAnkle: { x: number; y: number };
  rAnkle: { x: number; y: number };
}

export class KDanceDatabase extends Dexie {
  dances!: Table<DanceSession, string>;
  motion_events!: Table<MotionEventRow, number>;
  music_features!: Table<MusicFeatureRow, number>;
  raw_frames!: Table<RawFrameRow, number>;

  constructor() {
    super('KDanceDB');
    
    this.version(2).stores({
      dances: 'id, timestamp, style, bpm',
      motion_events: '++id, danceId, time, type',
      music_features: '++id, danceId',
      raw_frames: '++id, danceId, timeMs'
    });
  }
}

export const db = new KDanceDatabase();

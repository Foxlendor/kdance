import { db } from './db';

// Type the dance data import
interface DanceDataEntry {
  metadata: { id: string; title: string; style: string; source: string };
  music_features: { tempo: number; energy_curve: { times: number[]; values: number[] } };
  motion_events: Array<{
    time_ms: number;
    core: { x: number; y: number };
    l_wrist: { x: number; y: number };
    r_wrist: { x: number; y: number };
    l_ankle: { x: number; y: number };
    r_ankle: { x: number; y: number };
  }>;
}

let danceData: DanceDataEntry[] = [];
try {
  // Dynamic import to avoid build issues with empty/missing JSON
  danceData = require('../assets/dance_db.json') as DanceDataEntry[];
} catch {
  danceData = [];
}

export const dataIngester = {
  async bootstrap() {
    const count = await db.dances.count();
    
    if (count > 0) {
      console.log('Database already seeded with professional dance data.');
      return;
    }

    console.log(`Starting ingestion of ${danceData.length} professional dance sessions...`);

    for (const entry of danceData) {
      const danceId = entry.metadata.id;
      
      await db.transaction('rw', db.dances, db.raw_frames, db.music_features, async () => {
        // Add metadata
        await db.dances.add({
          id: danceId,
          timestamp: Date.now(),
          style: entry.metadata.style,
          bpm: entry.music_features.tempo,
          mood: 'Professional',
          source: 'video'
        });

        // Add music features
        await db.music_features.add({
          danceId: danceId,
          tempo: entry.music_features.tempo,
          energyCurve: entry.music_features.energy_curve.values
        });

        // Add raw frames (the motion intelligence)
        const frames = entry.motion_events.map((f: any) => ({
          danceId: danceId,
          timeMs: f.time_ms,
          core: f.core,
          lWrist: f.l_wrist,
          rWrist: f.r_wrist,
          lAnkle: f.l_ankle,
          rAnkle: f.r_ankle
        }));

        // Bulk add to raw_frames
        await db.raw_frames.bulkAdd(frames);
      });

      console.log(`Ingested: ${entry.metadata.title}`);
    }

    console.log('Choreographic Database Ingestion Complete!');
  }
};

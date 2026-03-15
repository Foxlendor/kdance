# K.DANCE Architecture

K.DANCE is a purely browser-based "motion to generative music" web application. It turns live dance movement (via webcam) or offline uploaded videos into structured musical output (audio via Tone.js or MIDI to a DAW). 

## Tech Stack & Libraries
- **Frontend Framework**: React + TypeScript (via Vite) for a modern, fast, type-safe UI.
- **Styling**: Tailwind CSS (for minimal, clean UI).
- **Motion Capture (Input Layer)**: `@tensorflow-models/pose-detection` (MoveNet) running via WebGL. Chosen for fast, robust, in-browser skeletal tracking without heavy backend GPU requirements.
- **Database (Dance Understanding Layer)**: `Dexie.js` (IndexedDB wrapper) for storing recorded dance sessions, motion event logs, and music features locally in the browser. 
- **Music Engine (Output Layer)**: `Tone.js` for in-browser synthesizer, drum machine, and FX rendering. (Easily swappable or augmentable with Web MIDI API).
- **Icons**: `lucide-react` for simple UI controls.

---

## High-Level Architecture Pipeline

```text
[ Input ]                      [ Processing ]                         [ DB / Retrieval ]                  [ Audio Output ]

Camera/Video  ===(Frames)==>   MoveNet Pose Model   ===(Keypoints)==> Motion Analysis Layer   ====(MotionEvents)====>  Music Planner Layer
(Live/Upload)                  (Extract 17 joints)                    (Calculate speed, size,                    |     (Finds matching patterns in DB)
                                                                       detect waves/hits)                        |     (Generates Music Plan)
                                                                                                                 |
                                                                                                                 v
                                                                                           <====== [ Dexie Local DB ] 
                                                                                             (Stores dances, motion_events)

                                                                                                                 |
                                                                                                                 v
Speakers/DAW  <===(Audio)==    Tone.js Synthesizers <==============   Music Engine        <=====(MusicPlan)=======
                               (Drums, Bass, Chords)                  (Schedules MIDI/Events 
                                                                       on the beat grid)
```

## Module Responsibilities

1. **`motion_analysis` (`src/services/motionDetector.ts`)**
   - **Input**: Raw skeletal keypoints frame-by-frame.
   - **Processing**: Computes velocities, acceleration, symmetry, "sharp vs smooth", and extracts higher-level discrete gestures (e.g., steps, hits, waves).
   - **Output**: `MotionEvent` objects `{ time, beatIndex, type, bodyPart, intensity, direction, duration }`.

2. **`db` layer (`src/services/db.ts`)**
   - Stores sessions persistently in the browser via IndexedDB.
   - **`dances` table**: Metadata about the session (style, BPM, source).
   - **`motion_events` table**: Log of all detected gestures and intensity curves.
   - **`music_features` table**: Correlated music plans or rhythmic structures.

3. **`music_planner` (`src/services/musicPlanner.ts`)**
   - **Input**: A rolling window of recent `MotionEvent`s (e.g., the last 2-4 bars).
   - **Processing**: Queries the database to find similar motion windows (by energy, gesture types, tempo). If a match is found, adapts the corresponding musical pattern. If not, falls back to generative rules based on current style presets.
   - **Output**: A `MusicPlan` (patterns, fills, bass riffs, FX automation).

4. **`music_engine` (`src/services/musicEngine.ts`)**
   - The real-time playback scheduler. 
   - Consumes the `MusicPlan` and schedules Tone.js synths or Web MIDI messages accurately on the transport timeline so there is zero jitter.

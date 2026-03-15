import * as Tone from 'tone';
import type { MusicPlan, MotionEvent } from '../types';

class MusicEngine {
  private synth?: Tone.PolySynth;
  private bass?: Tone.Synth;
  private kick?: Tone.MembraneSynth;
  private snare?: Tone.NoiseSynth;
  private hat?: Tone.MetalSynth;

  // Separate synths for manual events to avoid scheduling conflicts with Tone.Transport
  public manualKick?: Tone.MembraneSynth;
  public manualSnare?: Tone.NoiseSynth;
  
  private filter?: Tone.Filter;
  private reverb?: Tone.Reverb;
  private distortion?: Tone.Distortion;
  
  private isInitialized = false;
  private currentStyle = 'House Shuffle';
  private intensity = 0.5;
  private baseBpm = 120;
  
  private loopIds: number[] = [];
  
  constructor() {
    // Defer initialization
  }

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    
    this.filter = new Tone.Filter(400, "lowpass").toDestination();
    this.reverb = new Tone.Reverb(2).connect(this.filter);
    this.distortion = new Tone.Distortion(0.4).connect(this.filter);
    
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.reverb);
    this.bass = new Tone.Synth({ 
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 1.0, release: 0.8 }
    }).connect(this.distortion);
    
    this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 10, oscillator: { type: 'sine' }
    }).toDestination();

    this.manualKick = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 10, oscillator: { type: 'sine' }
    }).toDestination();

    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).toDestination();

    this.manualSnare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).toDestination();

    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).toDestination();
    this.hat.volume.value = -15;
    
    await this.reverb.generate();
    this.setupLoops();
    this.isInitialized = true;
  }

  private setupLoops() {
    // Clear existing loops
    this.loopIds.forEach(id => Tone.Transport.clear(id));
    this.loopIds = [];

    const progressions: Record<string, string[][]> = {
      'House Shuffle': [["C4", "E4", "G4", "B4"], ["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["G3", "B3", "D4", "F4"]],
      'Dark 808 Boom Bap': [["C3", "Eb3", "G3"], ["Ab2", "C3", "Eb3"], ["G2", "B2", "D3"], ["F2", "Ab2", "C3"]],
      'Trap': [["Cm", "Eb", "G"], ["Ab", "C", "Eb"], ["Fm", "Ab", "C"], ["G", "B", "D"]],
      'Phonk': [["C#m", "E", "G#"], ["Am", "C", "E"], ["G#m", "B", "D#"], ["F#m", "A", "C#"]]
    };

    // 1. GENERATIVE CHORDS (1 measure repeat)
    let chordIndex = 0;
    const chordLoop = Tone.Transport.scheduleRepeat((time) => {
      const p = progressions[this.currentStyle] || progressions['House Shuffle'];
      const chord = p[chordIndex % p.length];
      const velocity = 0.15 + (this.intensity * 0.1);
      this.synth?.triggerAttackRelease(chord, "1m", time, velocity);
      chordIndex++;
    }, "1m");
    this.loopIds.push(chordLoop);

    // 2. DYNAMIC DRUM SEQUENCER (16th notes)
    let step = 0;
    const drumLoop = Tone.Transport.scheduleRepeat((time) => {
      const isDownbeat = step % 4 === 0;
      const isBackbeat = step % 8 === 4;
      
      // KICK
      if (isDownbeat) {
        // Diversify kick based on style and intensity
        if (this.currentStyle === 'House Shuffle' || (this.currentStyle === 'Trap' && step % 16 === 0) || Math.random() < this.intensity * 0.3) {
          this.kick?.triggerAttackRelease("C1", "8n", time, 0.8);
        }
      }

      // SNARE
      if (isBackbeat) {
        const snareVel = 0.5 + (this.intensity * 0.3);
        this.snare?.triggerAttackRelease("16n", time, snareVel);
      }

      // HI-HATS (with swing and probability)
      const hatProb = 0.5 + (this.intensity * 0.5);
      if (Math.random() < hatProb) {
        const isOffbeat = step % 2 !== 0;
        const hatVel = isOffbeat ? 0.3 : 0.15;
        // Trap rolls
        if (this.intensity > 0.7 && (this.currentStyle === 'Trap' || this.currentStyle === 'Drill') && Math.random() > 0.8) {
           this.hat?.triggerAttackRelease("32n", time, 0.4);
           this.hat?.triggerAttackRelease("32n", time + Tone.Time("32n").toSeconds(), 0.3);
        } else {
           this.hat?.triggerAttackRelease("32n", time, hatVel);
        }
      }

      step = (step + 1) % 16;
    }, "16n");
    this.loopIds.push(drumLoop);

    // 3. BASSLINE
    const bassLoop = Tone.Transport.scheduleRepeat((time) => {
      if (!this.bass) return;
      const prob = 0.3 + (this.intensity * 0.6);
      if (Math.random() < prob) {
        const notes = ["C2", "Eb2", "G2", "Ab1", "F1"];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const dur = this.intensity > 0.6 ? "16n" : "8n";
        this.bass.triggerAttackRelease(note, dur, time, 0.6);
      }
    }, "8n");
    this.loopIds.push(bassLoop);
  }

  public setStyle(style: string) {
      if (this.currentStyle === style) return;
      this.currentStyle = style;
      if (!this.distortion) return;
      
      switch(style) {
          case 'Dark 808 Boom Bap':
          case 'Trap':
          case 'Phonk':
              this.baseBpm = 90;
              Tone.Transport.bpm.rampTo(90, 1);
              this.distortion.distortion = 0.8;
              break;
          case 'Drill':
              this.baseBpm = 140;
              Tone.Transport.bpm.rampTo(140, 1);
              this.distortion.distortion = 0.6;
              break;
          case 'Lofi':
              this.baseBpm = 80;
              Tone.Transport.bpm.rampTo(80, 1);
              this.distortion.distortion = 0.2;
              break;
          case 'Liquid DnB':
              this.baseBpm = 170;
              Tone.Transport.bpm.rampTo(170, 1);
              this.distortion.distortion = 0.3;
              break;
          default:
              this.baseBpm = 120;
              Tone.Transport.bpm.rampTo(120, 1);
              this.distortion.distortion = 0.4;
      }
      // Re-setup loops for potential style-specific logic changes
      if (this.isInitialized) this.setupLoops();
  }

  public start() {
    Tone.Transport.start();
  }

  public stop() {
    Tone.Transport.stop();
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.5);
  }

  public executePlan(plan: MusicPlan) {
    if (!this.isInitialized) return;
    const cutoffFreq = 200 + (plan.fxAutomation.filterCutoff * 6000);
    this.filter?.frequency.rampTo(cutoffFreq, 0.2);
    this.reverb?.wet.rampTo(plan.fxAutomation.reverbMix, 0.2);
  }

  public updateIntensity(intensity: number) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    // Dynamically adjust effects based on intensity
    if (this.distortion) {
        this.distortion.wet.rampTo(this.intensity * 0.5, 0.1);
    }
    
    // Live manipulation of music through movement
    // 0 intensity -> 0.5x speed (half speed)
    // 0.5 intensity -> 1x speed (normal speed)
    // 1.0 intensity -> 2x speed (double speed)
    const speedMultiplier = 0.5 + (this.intensity * 1.5);
    const targetBpm = this.baseBpm * speedMultiplier;
    Tone.Transport.bpm.rampTo(targetBpm, 0.5);
  }

  public setMute(mute: boolean) {
    Tone.Destination.mute = mute;
  }

  public handleEvent(event: MotionEvent) {
    if (!this.isInitialized) return;
    
    if (event.type === 'step') {
      this.manualKick?.triggerAttackRelease("C1", "4n", "+0", 1.0);
    } else if (event.type === 'hit') {
      this.manualSnare?.triggerAttackRelease("16n", "+0", 0.9);
    } else if (event.type === 'wave') {
      this.filter?.frequency.rampTo(8000, 0.2);
      setTimeout(() => this.filter?.frequency.rampTo(400, 1.5), 200);
    } else if (event.type === 'tutting') {
      // Glitchy/robotic filter effect for tutting
      this.filter?.frequency.rampTo(200, 0.05);
      setTimeout(() => this.filter?.frequency.rampTo(8000, 0.05), 100);
    } else if (event.type === 'footwork') {
      // Fast hi-hat burst for footwork
      this.hat?.triggerAttackRelease("32n", "+0", 0.6);
      setTimeout(() => this.hat?.triggerAttackRelease("32n", "+0", 0.4), 100);
    }
  }
}

export const musicEngine = new MusicEngine();

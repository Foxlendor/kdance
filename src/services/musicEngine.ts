import * as Tone from 'tone';
import type { MusicPlan, MotionEvent } from '../types';

class MusicEngine {
  // Core instruments
  private synth?: Tone.PolySynth;
  private bass?: Tone.Synth;
  private kick?: Tone.MembraneSynth;
  private snare?: Tone.NoiseSynth;
  private hat?: Tone.MetalSynth;
  
  // Manual trigger instruments (avoid scheduling conflicts)
  public manualKick?: Tone.MembraneSynth;
  public manualSnare?: Tone.NoiseSynth;
  
  // Additional instruments for new move types
  private riseSynth?: Tone.Synth;       // armRaise: ascending tone
  private impactSynth?: Tone.Synth;     // drop: heavy sub impact
  private popSynth?: Tone.Synth;        // pop: short percussive stab
  private spinSynth?: Tone.Synth;       // spin: whoosh/sweep
  private freezePad?: Tone.Synth;       // freeze: sustained pad swell
  private pluckSynth?: Tone.Synth;      // isolation: pluck accent
  private rollSynth?: Tone.Synth;       // bodyRoll: smooth pitch bend

  // Effects chain
  private filter?: Tone.Filter;
  private reverb?: Tone.Reverb;
  private distortion?: Tone.Distortion;
  private delay?: Tone.FeedbackDelay;
  private compressor?: Tone.Compressor;
  private chorus?: Tone.Chorus;
  
  private isInitialized = false;
  private currentStyle = 'House Shuffle';
  private intensity = 0.5;
  private baseBpm = 120;
  
  private loopIds: number[] = [];
  
  // Event cooldowns to avoid sound spam
  private lastEventTimes: Record<string, number> = {};
  private eventCooldowns: Record<string, number> = {
    hit: 80,
    step: 100,
    tutting: 120,
    footwork: 80,
    armRaise: 400,
    drop: 500,
    jump: 600,
    bodyRoll: 300,
    isolation: 200,
    pop: 100,
    spin: 800,
    freeze: 1000,
    wave: 250,
  };
  
  constructor() {
    // Defer initialization
  }

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    
    // Master effects chain
    this.compressor = new Tone.Compressor(-20, 4).toDestination();
    this.filter = new Tone.Filter(400, "lowpass").connect(this.compressor);
    this.reverb = new Tone.Reverb(2).connect(this.filter);
    this.delay = new Tone.FeedbackDelay("8n", 0.3).connect(this.filter);
    this.delay.wet.value = 0;
    this.distortion = new Tone.Distortion(0.4).connect(this.filter);
    this.chorus = new Tone.Chorus(4, 2.5, 0.5).connect(this.filter);
    this.chorus.wet.value = 0;
    
    // Core instruments
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.reverb);
    this.synth.volume.value = -8;
    
    this.bass = new Tone.Synth({ 
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 1.0, release: 0.8 }
    }).connect(this.distortion);
    this.bass.volume.value = -4;
    
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 10, oscillator: { type: 'sine' }
    }).connect(this.compressor);

    this.manualKick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 10, oscillator: { type: 'sine' }
    }).connect(this.compressor);

    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).connect(this.compressor);

    this.manualSnare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).connect(this.compressor);

    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(this.compressor);
    this.hat.volume.value = -15;
    
    // ===== NEW MOVE-SPECIFIC INSTRUMENTS =====
    
    // ARM RAISE: ascending shimmer synth
    this.riseSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.4, sustain: 0.2, release: 1.2 }
    }).connect(this.reverb);
    this.riseSynth.volume.value = -10;
    
    // DROP: heavy sub impact
    this.impactSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 }
    }).connect(this.distortion);
    this.impactSynth.volume.value = -2;
    
    // POP: short percussive stab
    this.popSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
    }).connect(this.filter);
    this.popSynth.volume.value = -6;
    
    // SPIN: whoosh sweep synth
    this.spinSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 1.0, sustain: 0, release: 0.5 }
    }).connect(this.chorus);
    this.spinSynth.volume.value = -8;
    
    // FREEZE: sustained pad
    this.freezePad = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 1.0, decay: 0.5, sustain: 0.8, release: 2.0 }
    }).connect(this.reverb);
    this.freezePad.volume.value = -12;
    
    // ISOLATION: pluck
    this.pluckSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 }
    }).connect(this.delay);
    this.pluckSynth.volume.value = -8;
    
    // BODY ROLL: smooth pitch-bending tone
    this.rollSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.6, sustain: 0.3, release: 0.8 }
    }).connect(this.chorus);
    this.rollSynth.volume.value = -10;
    
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
      'Trap': [["C3", "Eb3", "G3"], ["Ab2", "C3", "Eb3"], ["F2", "Ab2", "C3"], ["G2", "Bb2", "D3"]],
      'Phonk': [["C3", "E3", "G3"], ["A2", "C3", "E3"], ["G2", "B2", "D3"], ["F2", "A2", "C3"]],
      'Lofi': [["Cmaj7", "Am7", "Fmaj7", "G7"].map(() => "C4"), ["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["G3", "B3", "D4"]],
      'Liquid DnB': [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]],
    };

    // 1. GENERATIVE CHORDS (1 measure repeat)
    let chordIndex = 0;
    const chordLoop = Tone.Transport.scheduleRepeat((time) => {
      const p = progressions[this.currentStyle] || progressions['House Shuffle'];
      const chord = p[chordIndex % p.length];
      const velocity = 0.12 + (this.intensity * 0.12);
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
        if (this.currentStyle === 'House Shuffle' || 
            (this.currentStyle === 'Trap' && step % 16 === 0) || 
            Math.random() < this.intensity * 0.3) {
          this.kick?.triggerAttackRelease("C1", "8n", time, 0.7 + this.intensity * 0.2);
        }
      }

      // SNARE
      if (isBackbeat) {
        const snareVel = 0.4 + (this.intensity * 0.35);
        this.snare?.triggerAttackRelease("16n", time, snareVel);
      }

      // HI-HATS (with swing and probability)
      const hatProb = 0.4 + (this.intensity * 0.55);
      if (Math.random() < hatProb) {
        const isOffbeat = step % 2 !== 0;
        const hatVel = isOffbeat ? 0.25 : 0.12;
        // Trap rolls at high intensity
        if (this.intensity > 0.7 && 
            (this.currentStyle === 'Trap' || this.currentStyle === 'Drill' || this.currentStyle === 'Phonk') && 
            Math.random() > 0.75) {
          this.hat?.triggerAttackRelease("32n", time, 0.35);
          this.hat?.triggerAttackRelease("32n", time + Tone.Time("32n").toSeconds(), 0.25);
          this.hat?.triggerAttackRelease("32n", time + Tone.Time("32n").toSeconds() * 2, 0.15);
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
      const prob = 0.25 + (this.intensity * 0.6);
      if (Math.random() < prob) {
        const notes = ["C2", "Eb2", "G2", "Ab1", "F1", "Bb1"];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const dur = this.intensity > 0.6 ? "16n" : "8n";
        this.bass.triggerAttackRelease(note, dur, time, 0.5 + this.intensity * 0.2);
      }
    }, "8n");
    this.loopIds.push(bassLoop);
  }

  private canTrigger(eventType: string): boolean {
    const now = performance.now();
    const cooldown = this.eventCooldowns[eventType] || 100;
    const lastTime = this.lastEventTimes[eventType] || 0;
    if (now - lastTime < cooldown) return false;
    this.lastEventTimes[eventType] = now;
    return true;
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
    
    // Apply optional delay and distortion from planner
    if (plan.fxAutomation.delayMix !== undefined && this.delay) {
      this.delay.wet.rampTo(plan.fxAutomation.delayMix, 0.3);
    }
    if (plan.fxAutomation.distortion !== undefined && this.distortion) {
      this.distortion.wet.rampTo(plan.fxAutomation.distortion, 0.3);
    }
    if (plan.bpmTarget) {
      Tone.Transport.bpm.rampTo(plan.bpmTarget, 1);
    }
  }

  public updateIntensity(intensity: number) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    
    if (this.distortion) {
      this.distortion.wet.rampTo(this.intensity * 0.5, 0.1);
    }
    if (this.chorus) {
      this.chorus.wet.rampTo(this.intensity > 0.6 ? 0.3 : 0, 0.3);
    }
    
    const speedMultiplier = 0.5 + (this.intensity * 1.5);
    const targetBpm = this.baseBpm * speedMultiplier;
    Tone.Transport.bpm.rampTo(targetBpm, 0.5);
  }

  public setMute(mute: boolean) {
    Tone.Destination.mute = mute;
  }

  public handleEvent(event: MotionEvent) {
    if (!this.isInitialized) return;
    if (!this.canTrigger(event.type)) return;
    
    const vol = -6 + (event.intensity * 6); // -6 to 0 dB based on intensity

    switch (event.type) {
      case 'step':
        // Kick drum on beat steps
        this.manualKick?.triggerAttackRelease("C1", "4n", "+0", Math.min(event.intensity + 0.3, 1.0));
        break;
        
      case 'hit':
        // Snare crack on hits
        this.manualSnare?.triggerAttackRelease("16n", "+0", Math.min(event.intensity + 0.2, 1.0));
        break;
        
      case 'wave':
        // Filter sweep — opens up and slowly closes
        this.filter?.frequency.rampTo(4000 + event.intensity * 4000, 0.15);
        setTimeout(() => this.filter?.frequency.rampTo(400, 1.2), 150);
        // Add subtle delay on waves
        if (this.delay) {
          this.delay.wet.rampTo(0.25, 0.1);
          setTimeout(() => this.delay?.wet.rampTo(0, 1.5), 300);
        }
        break;
        
      case 'tutting':
        // Glitchy robotic filter stutter
        this.filter?.frequency.rampTo(200, 0.03);
        setTimeout(() => this.filter?.frequency.rampTo(6000, 0.03), 60);
        setTimeout(() => this.filter?.frequency.rampTo(300, 0.03), 120);
        // Percussive click
        this.popSynth?.triggerAttackRelease("G5", "32n", "+0", 0.4);
        break;
        
      case 'footwork':
        // Rapid hi-hat bursts
        this.hat?.triggerAttackRelease("32n", "+0", 0.5);
        setTimeout(() => this.hat?.triggerAttackRelease("32n", "+0", 0.35), 70);
        setTimeout(() => this.hat?.triggerAttackRelease("32n", "+0", 0.2), 140);
        break;
        
      case 'armRaise':
        // Ascending shimmer — pitch rises with arms
        if (this.riseSynth) {
          const note = event.intensity > 0.7 ? "C6" : event.intensity > 0.4 ? "G5" : "E5";
          this.riseSynth.triggerAttackRelease(note, "2n", "+0", 0.4 * event.intensity);
        }
        // Open up reverb and filter
        this.reverb?.wet.rampTo(0.7, 0.3);
        this.filter?.frequency.rampTo(6000, 0.4);
        setTimeout(() => {
          this.reverb?.wet.rampTo(0.3, 1);
          this.filter?.frequency.rampTo(400, 1);
        }, 600);
        break;
        
      case 'drop':
        // Heavy sub-bass impact + filter slam down
        if (this.impactSynth) {
          this.impactSynth.triggerAttackRelease("C1", "4n", "+0", Math.min(event.intensity + 0.3, 1.0));
        }
        this.manualKick?.triggerAttackRelease("C1", "4n", "+0", 1.0);
        // Slam filter shut then reopen
        this.filter?.frequency.rampTo(100, 0.02);
        if (this.distortion) this.distortion.wet.rampTo(0.8, 0.05);
        setTimeout(() => {
          this.filter?.frequency.rampTo(2000, 0.8);
          this.distortion?.wet.rampTo(this.intensity * 0.5, 0.5);
        }, 200);
        break;
        
      case 'jump':
        // Layered impact: kick + noise burst + filter sweep
        this.manualKick?.triggerAttackRelease("C1", "2n", "+0", 1.0);
        this.manualSnare?.triggerAttackRelease("8n", "+0", 0.8);
        if (this.riseSynth) {
          this.riseSynth.triggerAttackRelease("C5", "4n", "+0", 0.5);
        }
        // Big reverb splash
        this.reverb?.wet.rampTo(0.8, 0.1);
        setTimeout(() => this.reverb?.wet.rampTo(0.3, 1.5), 300);
        break;
        
      case 'bodyRoll':
        // Smooth pitch-bending tone with chorus
        if (this.rollSynth) {
          const rollNote = event.intensity > 0.5 ? "E4" : "C4";
          this.rollSynth.triggerAttackRelease(rollNote, "4n", "+0", 0.35);
        }
        // Gentle chorus swell
        if (this.chorus) {
          this.chorus.wet.rampTo(0.5, 0.2);
          setTimeout(() => this.chorus?.wet.rampTo(0, 0.8), 400);
        }
        break;
        
      case 'isolation':
        // Precise pluck with delay tail
        if (this.pluckSynth) {
          const isoNote = event.bodyPart === 'leftArm' ? "A4" : "E5";
          this.pluckSynth.triggerAttackRelease(isoNote, "16n", "+0", 0.6);
        }
        // Momentary delay
        if (this.delay) {
          this.delay.wet.rampTo(0.35, 0.05);
          setTimeout(() => this.delay?.wet.rampTo(0, 0.6), 200);
        }
        break;
        
      case 'pop':
        // Sharp percussive stab
        if (this.popSynth) {
          this.popSynth.triggerAttackRelease("C5", "32n", "+0", 0.7 * event.intensity);
        }
        // Momentary distortion spike
        if (this.distortion) {
          this.distortion.wet.rampTo(0.9, 0.01);
          setTimeout(() => this.distortion?.wet.rampTo(this.intensity * 0.5, 0.15), 50);
        }
        // Snap hi-hat
        this.hat?.triggerAttackRelease("64n", "+0", 0.6);
        break;
        
      case 'spin':
        // Swooshing sweep from low to high
        if (this.spinSynth) {
          this.spinSynth.frequency.rampTo(200, 0.01);
          this.spinSynth.triggerAttackRelease("C3", "1n", "+0", 0.4);
          this.spinSynth.frequency.rampTo(2000, 0.8);
        }
        // Filter sweeps up with the spin
        this.filter?.frequency.rampTo(8000, 0.6);
        setTimeout(() => this.filter?.frequency.rampTo(400, 1.0), 800);
        // Delay trail
        if (this.delay) {
          this.delay.wet.rampTo(0.4, 0.2);
          setTimeout(() => this.delay?.wet.rampTo(0, 1.0), 600);
        }
        break;
        
      case 'freeze':
        // Silence drums momentarily, swell reverb pad
        if (this.freezePad) {
          this.freezePad.triggerAttackRelease("C4", "2n", "+0", 0.3);
        }
        // Open reverb wide
        this.reverb?.wet.rampTo(0.9, 0.5);
        // Dampen everything else
        this.filter?.frequency.rampTo(200, 0.3);
        setTimeout(() => {
          this.reverb?.wet.rampTo(0.3, 1);
          this.filter?.frequency.rampTo(400, 0.5);
        }, 1500);
        break;
    }
  }
}

export const musicEngine = new MusicEngine();

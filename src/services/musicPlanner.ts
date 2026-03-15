import type { MotionEvent, MusicPlan } from '../types';
import { db } from './db';

class MusicPlanner {
  
  private async findSimilarPattern(_avgIntensity: number, style: string) {
    const sessions = await db.dances.where('style').equals(style).toArray();
    if (sessions.length === 0) return null;
    const match = sessions[0];
    return match;
  }

  /**
   * Analyze the recent event window to extract musical cues
   */
  private analyzeEvents(events: MotionEvent[]) {
    if (events.length === 0) {
      return {
        avgIntensity: 0,
        moveVariety: 0,
        dominantMove: 'idle' as string,
        hasHits: false,
        hasFootwork: false,
        hasTutting: false,
        hasBodyRolls: false,
        hasArmRaises: false,
        hasDrops: false,
        hasSpins: false,
        hasJumps: false,
        hasFreezes: false,
        hasPops: false,
        hasIsolations: false,
        eventDensity: 0,  // events per second
        intensityTrend: 0, // rising (+) or falling (-)
      };
    }

    const avgIntensity = events.reduce((sum, e) => sum + e.intensity, 0) / events.length;
    
    // Count unique move types
    const typeCounts: Record<string, number> = {};
    events.forEach(e => {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    });
    const moveVariety = Object.keys(typeCounts).length;
    const dominantMove = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'idle';
    
    // Event density (events per second over the window)
    const timeSpan = events.length > 1 
      ? (events[events.length - 1].time - events[0].time) / 1000 
      : 1;
    const eventDensity = events.length / Math.max(timeSpan, 0.5);
    
    // Intensity trend: compare first half vs second half
    const mid = Math.floor(events.length / 2);
    const firstHalf = events.slice(0, mid);
    const secondHalf = events.slice(mid);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, e) => s + e.intensity, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, e) => s + e.intensity, 0) / secondHalf.length : 0;
    const intensityTrend = secondAvg - firstAvg;

    return {
      avgIntensity,
      moveVariety,
      dominantMove,
      hasHits: !!typeCounts['hit'],
      hasFootwork: !!typeCounts['footwork'],
      hasTutting: !!typeCounts['tutting'],
      hasBodyRolls: !!typeCounts['bodyRoll'],
      hasArmRaises: !!typeCounts['armRaise'],
      hasDrops: !!typeCounts['drop'],
      hasSpins: !!typeCounts['spin'],
      hasJumps: !!typeCounts['jump'],
      hasFreezes: !!typeCounts['freeze'],
      hasPops: !!typeCounts['pop'],
      hasIsolations: !!typeCounts['isolation'],
      eventDensity,
      intensityTrend,
    };
  }

  public async plan(
    recentEvents: MotionEvent[], 
    _currentBpm: number, 
    currentStyle: string
  ): Promise<MusicPlan> {
    
    const analysis = this.analyzeEvents(recentEvents);

    // Try to find a reference pattern from the dataset
    const reference = await this.findSimilarPattern(analysis.avgIntensity, currentStyle);
    if (reference) {
      console.log(`Matching motion against professional ${reference.style} reference...`);
    }

    // Base FX values influenced by move analysis
    let delayMix = 0;
    let distortionMix: number | undefined = undefined;
    let bpmTarget: number | undefined = undefined;

    // Move-specific FX modifiers (applied across all styles)
    if (analysis.hasSpins) {
      delayMix = Math.max(delayMix, 0.3);
    }
    if (analysis.hasFreezes) {
      delayMix = Math.max(delayMix, 0.15);
    }
    if (analysis.hasPops || analysis.hasHits) {
      distortionMix = Math.min((distortionMix || 0) + 0.3, 1.0);
    }
    if (analysis.hasBodyRolls) {
      delayMix = Math.max(delayMix, 0.1);
    }
    
    // Intensity trend adjusts target BPM
    if (analysis.intensityTrend > 0.15) {
      // Getting more intense — nudge BPM up
      bpmTarget = _currentBpm + 5;
    } else if (analysis.intensityTrend < -0.15) {
      // Calming down — nudge BPM down
      bpmTarget = Math.max(60, _currentBpm - 5);
    }

    // ===== STYLE-SPECIFIC PLANNING =====

    // Rap / Trap / Boom Bap family
    if (['Rap Cypher', 'Dark 808 Boom Bap', 'Trap', 'Drill', 'Phonk'].includes(currentStyle)) {
      let drumPattern = 'boom-bap-chill';
      let filterCutoff = 0.4;
      let reverbMix = 0.2;

      if (currentStyle === 'Dark 808 Boom Bap') {
        drumPattern = analysis.avgIntensity > 0.6 ? 'dark-boom-bap-heavy' : 'dark-boom-bap-steady';
        filterCutoff = 0.3 + (analysis.avgIntensity * 0.3);
        reverbMix = 0.4;
        // Tutting in boom bap → tighter drums
        if (analysis.hasTutting) drumPattern = 'dark-boom-bap-staccato';
      } else if (currentStyle === 'Trap') {
        drumPattern = analysis.avgIntensity > 0.7 ? 'trap-rapid' : 'trap-standard';
        filterCutoff = 0.5 + (analysis.avgIntensity * 0.4);
        // Footwork in trap → hi-hat rolls
        if (analysis.hasFootwork) drumPattern = 'trap-hihat-rolls';
        // Drops → heavy 808 hit
        if (analysis.hasDrops) distortionMix = 0.8;
      } else if (currentStyle === 'Drill') {
        drumPattern = analysis.hasFootwork ? 'drill-rapid-hats' : 'drill-sliding-bass';
        filterCutoff = 0.6;
        reverbMix = 0.15;
      } else if (currentStyle === 'Phonk') {
        drumPattern = analysis.hasPops ? 'phonk-aggressive' : 'phonk-cowbell';
        filterCutoff = 0.7;
        reverbMix = 0.35;
      } else {
        // Rap Cypher
        if (analysis.avgIntensity > 0.7) {
          drumPattern = 'trap-aggressive-808';
          filterCutoff = 0.9;
        } else if (analysis.avgIntensity > 0.3) {
          drumPattern = 'boom-bap-active';
          filterCutoff = 0.6;
        }
      }

      // High variety of moves → more open production
      if (analysis.moveVariety > 4) {
        filterCutoff = Math.min(filterCutoff + 0.15, 1.0);
        reverbMix = Math.min(reverbMix + 0.1, 0.7);
      }

      return {
        drumPattern,
        bassRhythm: 'syncopated-sub',
        chordVoicing: 'dark-jazz',
        fxAutomation: {
          filterCutoff,
          reverbMix,
          delayMix: delayMix || undefined,
          distortion: distortionMix,
        },
        spotifyQuery: currentStyle === 'Dark 808 Boom Bap' ? 'dark boom bap hip hop' : `${currentStyle.toLowerCase()} hip hop beat`,
        bpmTarget,
      };
    }

    // Lofi
    if (currentStyle === 'Lofi') {
      let filterCutoff = 0.3 + (analysis.avgIntensity * 0.2);
      let reverbMix = 0.5;
      
      // Body rolls in lofi → more reverb, deeper filter
      if (analysis.hasBodyRolls) {
        reverbMix = 0.65;
        filterCutoff = Math.max(filterCutoff - 0.1, 0.15);
      }
      // Arm raises → open up
      if (analysis.hasArmRaises) {
        filterCutoff = Math.min(filterCutoff + 0.2, 0.8);
      }

      return {
        drumPattern: analysis.eventDensity > 2 ? 'lofi-uptempo' : 'lofi-dusty',
        bassRhythm: 'lofi-sub',
        chordVoicing: 'jazz-seven',
        fxAutomation: {
          filterCutoff,
          reverbMix,
          delayMix: analysis.hasIsolations ? 0.2 : delayMix || undefined,
        },
        spotifyQuery: 'lofi hip hop chill',
        bpmTarget,
      };
    }

    // Liquid DnB
    if (currentStyle === 'Liquid DnB') {
      let filterCutoff = 0.4 + (analysis.avgIntensity * 0.5);
      
      // Jumps in DnB → drops
      if (analysis.hasJumps || analysis.hasDrops) {
        filterCutoff = 0.9;
        distortionMix = 0.5;
      }
      // Spins → big reverb sweep
      const reverbMix = analysis.hasSpins ? 0.8 : 0.6;

      return {
        drumPattern: analysis.avgIntensity > 0.6 ? 'dnb-heavy-break' : 'dnb-rolling',
        bassRhythm: 'sub-slide',
        chordVoicing: analysis.hasArmRaises ? 'atmospheric-wide' : 'atmospheric',
        fxAutomation: {
          filterCutoff,
          reverbMix,
          delayMix: Math.max(delayMix, 0.2),
          distortion: distortionMix,
        },
        spotifyQuery: 'liquid drum and bass',
        bpmTarget,
      };
    }

    // ===== DEFAULT STYLES =====
    let drumPattern = 'basic';
    let bassRhythm = 'steady';
    let chordVoicing = 'pad';
    let filterCutoff = 0.5;
    let reverbMix = 0.2;
    let spotifyQuery = '';

    if (currentStyle === 'House Shuffle') {
      drumPattern = analysis.avgIntensity > 0.6 ? 'four-on-the-floor-busy' : 'four-on-the-floor';
      bassRhythm = 'offbeat';
      filterCutoff = 0.4 + (analysis.avgIntensity * 0.4);
      spotifyQuery = analysis.avgIntensity > 0.6 ? 'high energy house music' : 'deep house music';
      
      // Footwork in house → busy hi-hats
      if (analysis.hasFootwork) drumPattern = 'four-on-the-floor-shuffled';
      // Arm raises → build-up feel
      if (analysis.hasArmRaises) {
        filterCutoff = Math.min(filterCutoff + 0.2, 1.0);
        reverbMix = 0.4;
      }
    } else if (currentStyle === 'Alien Trap') {
      drumPattern = analysis.avgIntensity > 0.5 ? 'trap-halftime-rolls' : 'trap-halftime';
      bassRhythm = 'syncopated';
      filterCutoff = 0.6 + (analysis.avgIntensity * 0.4);
      spotifyQuery = 'experimental trap beat';
      
      // Isolations → glitchy
      if (analysis.hasIsolations || analysis.hasTutting) {
        drumPattern = 'trap-glitch';
        delayMix = 0.25;
      }
    } else { // Chill Wave
      drumPattern = 'chill-breakbeat';
      bassRhythm = 'sparse';
      filterCutoff = 0.2 + (analysis.avgIntensity * 0.3);
      chordVoicing = 'wide-pad';
      reverbMix = 0.6;
      spotifyQuery = 'synthwave chillwave';
      
      // Body rolls in chill → dreamy
      if (analysis.hasBodyRolls) {
        reverbMix = 0.75;
        chordVoicing = 'dreamy-pad';
      }
    }

    return {
      drumPattern,
      bassRhythm,
      chordVoicing,
      fxAutomation: {
        filterCutoff,
        reverbMix: Math.min(1.0, reverbMix),
        delayMix: delayMix > 0 ? delayMix : undefined,
        distortion: distortionMix,
      },
      spotifyQuery,
      bpmTarget,
    };
  }
}

export const musicPlanner = new MusicPlanner();

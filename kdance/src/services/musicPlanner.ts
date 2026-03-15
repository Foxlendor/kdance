import type { MotionEvent, MusicPlan } from '../types';
import { db } from './db';

class MusicPlanner {
  
  // Finds the most similar motion pattern in the database based on intensity and style
  private async findSimilarPattern(_avgIntensity: number, style: string) {
    // Get professional sessions that match the style
    const sessions = await db.dances.where('style').equals(style).toArray();
    if (sessions.length === 0) return null;

    // Simplified similarity: Find a session with a similar average energy
    // In a real ML pipeline, we would compute a motion embedding and use cosine similarity.
    const match = sessions[0]; // for v1, just pick the first matching pro session
    return match;
  }

  // Given a recent window of MotionEvents, find similar motion windows in DB
  // or return a rule-based plan if nothing matches closely.
  public async plan(
    recentEvents: MotionEvent[], 
    _currentBpm: number, 
    currentStyle: string
  ): Promise<MusicPlan> {
    
    const avgIntensity = recentEvents.length > 0 
      ? recentEvents.reduce((sum, e) => sum + e.intensity, 0) / recentEvents.length 
      : 0;

    // Try to find a reference pattern from the YouTube dataset
    const reference = await this.findSimilarPattern(avgIntensity, currentStyle);
    if (reference) {
        console.log(`Matching motion against professional ${reference.style} reference...`);
    }

    // Rap Cypher Logic
    if (currentStyle === 'Rap Cypher' || currentStyle === 'Dark 808 Boom Bap' || currentStyle === 'Trap' || currentStyle === 'Drill' || currentStyle === 'Phonk') {
        let drumPattern = 'boom-bap-chill';
        let filterCutoff = 0.4;

        if (currentStyle === 'Dark 808 Boom Bap') {
            drumPattern = avgIntensity > 0.6 ? 'dark-boom-bap-heavy' : 'dark-boom-bap-steady';
            filterCutoff = 0.3 + (avgIntensity * 0.3); 
        } else if (currentStyle === 'Trap') {
            drumPattern = avgIntensity > 0.7 ? 'trap-rapid' : 'trap-standard';
            filterCutoff = 0.5 + (avgIntensity * 0.4);
        } else if (currentStyle === 'Drill') {
            drumPattern = 'drill-sliding-bass';
            filterCutoff = 0.6;
        } else if (currentStyle === 'Phonk') {
            drumPattern = 'phonk-cowbell';
            filterCutoff = 0.7;
        } else {
            if (avgIntensity > 0.7) {
                drumPattern = 'trap-aggressive-808'; 
                filterCutoff = 0.9;
            } else if (avgIntensity > 0.3) {
                drumPattern = 'boom-bap-active'; 
                filterCutoff = 0.6;
            }
        }

        return {
            drumPattern,
            bassRhythm: 'syncopated-sub',
            chordVoicing: 'dark-jazz',
            fxAutomation: {
                filterCutoff,
                reverbMix: (currentStyle === 'Dark 808 Boom Bap' || currentStyle === 'Phonk') ? 0.4 : 0.2
            },
            spotifyQuery: currentStyle === 'Dark 808 Boom Bap' ? 'dark boom bap hip hop' : 'trap hip hop'
        };
    }

    if (currentStyle === 'Lofi') {
        return {
            drumPattern: 'lofi-dusty',
            bassRhythm: 'lofi-sub',
            chordVoicing: 'jazz-seven',
            fxAutomation: {
                filterCutoff: 0.3 + (avgIntensity * 0.2),
                reverbMix: 0.5
            },
            spotifyQuery: 'lofi hip hop'
        };
    }

    if (currentStyle === 'Liquid DnB') {
        return {
            drumPattern: 'dnb-rolling',
            bassRhythm: 'sub-slide',
            chordVoicing: 'atmospheric',
            fxAutomation: {
                filterCutoff: 0.4 + (avgIntensity * 0.5),
                reverbMix: 0.6
            },
            spotifyQuery: 'liquid drum and bass'
        };
    }

    // Default Fallback
    let drumPattern = 'basic';
    let bassRhythm = 'steady';
    let chordVoicing = 'pad';
    let filterCutoff = 0.5;
    let reverbMix = 0.2;

    if (currentStyle === 'House Shuffle') {
      drumPattern = avgIntensity > 0.6 ? 'four-on-the-floor-busy' : 'four-on-the-floor';
      bassRhythm = 'offbeat';
      filterCutoff = 0.4 + (avgIntensity * 0.4);
    } else if (currentStyle === 'Alien Trap') {
      drumPattern = avgIntensity > 0.5 ? 'trap-halftime-rolls' : 'trap-halftime';
      bassRhythm = 'syncopated';
      filterCutoff = 0.6 + (avgIntensity * 0.4);
    } else { // Chill Wave
      drumPattern = 'chill-breakbeat';
      bassRhythm = 'sparse';
      filterCutoff = 0.2 + (avgIntensity * 0.3);
      chordVoicing = 'wide-pad';
      reverbMix = 0.6;
    }

    return {
      drumPattern,
      bassRhythm,
      chordVoicing,
      fxAutomation: {
        filterCutoff,
        reverbMix: Math.min(1.0, reverbMix)
      }
    };
  }
}

export const musicPlanner = new MusicPlanner();

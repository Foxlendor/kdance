import SpotifyWebApi from 'spotify-web-api-js';

class SpotifyService {
  private spotifyApi: SpotifyWebApi.SpotifyWebApiJs;
  private deviceId: string | null = null;
  private isInitialized = false;
  private onTrackChange?: (track: any) => void;
  private currentQuery: string | null = null;
  private playingTrackUris: Set<string> = new Set();
  
  constructor() {
    this.spotifyApi = new SpotifyWebApi();
  }

  public setToken(token: string) {
    this.spotifyApi.setAccessToken(token);
    this.isInitialized = true;
  }

  public setOnTrackChange(callback: (track: any) => void) {
    this.onTrackChange = callback;
  }

  public async searchAndPlay(query: string, forceChange = false) {
    if (!this.isInitialized || !query) return null;
    
    // If the style/query hasn't changed and we aren't forcing a change, don't restart the song
    if (!forceChange && this.currentQuery === query) {
        return null; 
    }

    try {
      // Get a playlist of tracks for this movement-based style to avoid repeating
      const results = await this.spotifyApi.searchTracks(query, { limit: 20 });
      let tracks = results.tracks.items.filter(t => !this.playingTrackUris.has(t.uri));
      
      // If we've played all tracks for this query, reset the history
      if (tracks.length === 0 && results.tracks.items.length > 0) {
          this.playingTrackUris.clear();
          tracks = results.tracks.items;
      }
      
      if (tracks.length > 0) {
        // Pick a random track from the available ones to add less tendency to repeat
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        
        console.log(`[Spotify] Found track: ${track.name} by ${track.artists[0].name} for query ${query}`);
        this.currentQuery = query;
        this.playingTrackUris.add(track.uri);

        if (this.onTrackChange) this.onTrackChange(track);
        
        // If we have a deviceId and are using the SDK, we would call play here
        if (this.deviceId) {
            await this.playTrack(track.uri);
        }
        return track;
      }
    } catch (e) {
      console.error('[Spotify] Search failed:', e);
    }
    return null;
  }

  public setDeviceId(id: string) {
    this.deviceId = id;
  }

  public async pause() {
    if (!this.isInitialized) return;
    try {
      await this.spotifyApi.pause();
    } catch (e) {
      console.log('[Spotify] Pause failed or no active device');
    }
  }

  public async playTrack(uri: string) {
    if (!this.isInitialized || !this.deviceId) return;
    try {
      await this.spotifyApi.play({
        device_id: this.deviceId,
        uris: [uri]
      });
    } catch (e) {
      console.error('[Spotify] Playback failed:', e);
    }
  }
}

export const spotifyService = new SpotifyService();

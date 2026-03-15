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

    if (!forceChange && this.currentQuery === query) {
        return null; 
    }

    try {
      const results = await this.spotifyApi.searchTracks(query, { limit: 20 });
      let tracks = results.tracks.items.filter(t => !this.playingTrackUris.has(t.uri));
      
      if (tracks.length === 0 && results.tracks.items.length > 0) {
          this.playingTrackUris.clear();
          tracks = results.tracks.items;
      }
      
      if (tracks.length > 0) {
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        
        console.log(`[Spotify] Found track: ${track.name} by ${track.artists[0].name} for query ${query}`);
        this.currentQuery = query;
        this.playingTrackUris.add(track.uri);

        if (this.onTrackChange) this.onTrackChange(track);
        
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

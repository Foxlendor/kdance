import React, { useState, useEffect } from 'react';
import { spotifyService } from '../services/spotifyService';
import { musicPlanner } from '../services/musicPlanner';
import { Music, LogIn, Play, Pause } from 'lucide-react';

export const SpotifyController: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    spotifyService.setOnTrackChange((track) => {
      setCurrentTrack(track);
    });
  }, []);

  // Spotify auth is complex for a local app without a redirect server
  // For v1, we allow the user to manually paste an access token 
  // from https://developer.spotify.com/documentation/web-playback-sdk/tutorials/get-your-token
  const handleLogin = () => {
    if (token) {
      spotifyService.setToken(token);
      setIsLoggedIn(true);
    } else {
      alert('Please paste a Spotify Access Token first.');
    }
  };

  return (
    <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <h3 className="font-black tracking-widest text-sm uppercase text-green-600 flex items-center gap-2">
          <Music size={18} /> Spotify Integration
        </h3>
        {isLoggedIn && (
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-bold uppercase tracking-wider">Connected</span>
           </div>
        )}
      </div>

      {!isLoggedIn ? (
        <div className="space-y-4">
          <p className="text-[11px] font-bold text-black/60 leading-relaxed uppercase">
            Paste a temporary token from Spotify Dev Dashboard to enable live track selection.
          </p>
          <input 
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Spotify Access Token..."
            className="w-full bg-gray-100 border-2 border-black p-3 text-xs font-mono outline-none focus:border-green-600"
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-black text-white p-3 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <LogIn size={16} /> Authenticate
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {currentTrack ? (
            <div className="flex items-center gap-4 bg-gray-100 p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {currentTrack.album.images[0] && (
                <img src={currentTrack.album.images[0].url} className="w-16 h-16 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" alt="Album Art" />
              )}
              <div className="overflow-hidden">
                <div className="font-black uppercase text-sm truncate">{currentTrack.name}</div>
                <div className="text-[10px] font-bold text-black/50 uppercase truncate">{currentTrack.artists[0].name}</div>
              </div>
            </div>
          ) : (

            <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-300">
               <span className="text-[11px] font-bold text-black/30 uppercase tracking-widest">Awaiting match...</span>
            </div>
          )}
          
          <p className="text-[9px] font-bold text-black/40 uppercase tracking-[0.2em] italic">
            Spotify will automatically play tracks matching your dance style.
          </p>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { VideoFeed } from './components/VideoFeed';
import { SpotifyController } from './components/SpotifyController';
import { dataIngester } from './services/dataIngester';
import { musicEngine } from './services/musicEngine';

function App() {
  const [stylePreset, setStylePreset] = useState('House Shuffle');
  const [audioMode, setAudioMode] = useState<'spotify' | 'generative'>('generative');

  useEffect(() => {
    dataIngester.bootstrap();
  }, []);

  useEffect(() => {
    if (audioMode === 'spotify') {
      musicEngine.setMute(true);
    } else {
      musicEngine.setMute(false);
      import('./services/spotifyService').then(({ spotifyService }) => {
          spotifyService.pause();
      });
    }
  }, [audioMode]);

  const handleStyleChange = (newStyle: string) => {
      setStylePreset(newStyle);
      musicEngine.setStyle(newStyle);
      
      // Immediately try to change the Spotify song based on the new style
      import('./services/musicPlanner').then(({ musicPlanner }) => {
          musicPlanner.plan([], 120, newStyle).then(plan => {
              if (plan.spotifyQuery) {
                  const query = plan.spotifyQuery;
                  import('./services/spotifyService').then(({ spotifyService }) => {
                      spotifyService.searchAndPlay(query, true);
                  });
              }
          });
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b-4 border-black pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center relative">
               <div className="absolute w-4 h-4 bg-red-600 rounded-full" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-widest uppercase">K.DANCE</h1>
              <p className="text-xs font-bold tracking-[0.3em] text-black/50 uppercase mt-1">Generative Neural Engine</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex bg-white border-2 border-black font-bold uppercase text-xs tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
               <button 
                 onClick={() => setAudioMode('generative')}
                 className={`px-3 py-2 ${audioMode === 'generative' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
               >
                 AI Audio
               </button>
               <button 
                 onClick={() => setAudioMode('spotify')}
                 className={`px-3 py-2 border-l-2 border-black ${audioMode === 'spotify' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
               >
                 Spotify
               </button>
            </div>
            <select 
              value={stylePreset}
              onChange={(e) => handleStyleChange(e.target.value)}
              className="bg-white border-2 border-black font-bold uppercase text-xs tracking-wider px-4 py-2 outline-none cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:border-red-600"
            >
              <option value="House Shuffle">House Shuffle</option>
              <option value="Alien Trap">Alien Trap</option>
              <option value="Chill Wave">Chill Wave</option>
              <option value="Rap Cypher">Rap Cypher</option>
              <option value="Dark 808 Boom Bap">Dark 808 Boom Bap</option>
              <option value="Lofi">Lofi</option>
              <option value="Trap">Trap</option>
              <option value="Drill">Drill</option>
              <option value="Phonk">Phonk</option>
              <option value="Liquid DnB">Liquid DnB</option>
            </select>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Input Layer */}
          <section className="space-y-6">
            <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2">Input: Motion Capture</h2>
            <VideoFeed stylePreset={stylePreset} />
          </section>

          {/* Right: Generative Audio Engine */}
          <section className="space-y-8">
            <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2">Output: Engines</h2>
            
            <SpotifyController />

            <div className="grid grid-cols-2 gap-6">
              {/* Mixer Mockup */}
              <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
                <h3 className="font-black tracking-widest text-sm uppercase text-red-600">Live Mixer</h3>
                
                {['Drums', 'Bass', 'Chords', 'FX'].map(track => (
                  <div key={track} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <span>{track}</span>
                      <span className="text-black/50">Auto</span>
                    </div>
                    <div className="h-4 bg-gray-200 border border-black overflow-hidden relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-black transition-all" style={{ width: `${Math.random() * 40 + 40}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Engine State */}
              <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <h3 className="font-black tracking-widest text-sm uppercase text-red-600">Engine State</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-black/50 uppercase tracking-widest block mb-1">Current Style</label>
                    <div className="text-lg font-black uppercase tracking-wider">{stylePreset}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-black/50 uppercase tracking-widest block mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                      <span className="text-sm font-bold uppercase tracking-wider">Synthesizing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;

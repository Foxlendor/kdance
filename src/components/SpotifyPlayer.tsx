"use client";

import { useEffect, useState, useRef } from "react";
import { spotifyService } from "../services/spotifyService";

interface SpotifyPlayerProps {
  accessToken: string;
}

export default function SpotifyPlayer({ accessToken }: SpotifyPlayerProps) {
  const [player, setPlayer] = useState<Spotify.Player | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Spotify.Track | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Everlock DJ Web Player",
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: 0.5,
      });

      playerRef.current = player;
      setPlayer(player);

      player.addListener("ready", ({ device_id }) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
        spotifyService.setDeviceId(device_id); // Connect our engine!
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID has gone offline", device_id);
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) {
          setIsActive(false);
          return;
        }

        setIsActive(true);
        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
      });

      player.connect();
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [accessToken]);

  const togglePlay = () => {
    if (player) {
      player.togglePlay();
    }
  };

  const nextTrack = () => {
    if (player) {
      player.nextTrack();
    }
  };

  const previousTrack = () => {
    if (player) {
      player.previousTrack();
    }
  };

  if (!isActive && !currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 text-center z-50">
        <p className="text-zinc-400">
          Player is ready. Open your Spotify app, play a song, and select "Everlock DJ Web Player" from the devices menu.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 flex items-center justify-between z-50">
      <div className="flex items-center gap-4 w-1/3">
        {currentTrack?.album.images[0]?.url && (
          <img
            src={currentTrack.album.images[0].url}
            alt={currentTrack.name}
            className="w-14 h-14 rounded-md shadow-md"
          />
        )}
        <div className="overflow-hidden">
          <p className="text-white font-medium truncate">{currentTrack?.name}</p>
          <p className="text-zinc-400 text-sm truncate">
            {currentTrack?.artists.map((artist) => artist.name).join(", ")}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-1/3 gap-2">
        <div className="flex items-center gap-6">
          <button
            onClick={previousTrack}
            className="text-zinc-400 hover:text-white transition"
            aria-label="Previous"
          >
            &#9198;
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition"
            aria-label={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? <span>&#9654;</span> : <span className="text-sm">&#10074;&#10074;</span>}
          </button>
          <button
            onClick={nextTrack}
            className="text-zinc-400 hover:text-white transition"
            aria-label="Next"
          >
            &#9199;
          </button>
        </div>
      </div>

      <div className="w-1/3 flex justify-end">
         {/* Volume control or other features could go here */}
      </div>
    </div>
  );
}

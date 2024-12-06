"use client";

import { useState, useEffect } from "react";
import { Playlist } from "@/types/music";

// Mock data - replace with real API calls
const mockPlaylists: Record<string, Playlist> = {
  "recently-added": {
    id: "recently-added",
    name: "Recently Added",
    coverUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    tracks: [
      {
        id: "1",
        title: "Midnight City",
        artist: "Neon Dreams",
        album: "Night Drive",
        duration: 272,
        coverUrl:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop",
      },
      {
        id: "2",
        title: "Summer Nights",
        artist: "The Midnight",
        album: "Days of Thunder",
        duration: 225,
        coverUrl:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60&fit=crop",
      },
    ],
  },
  "recently-played": {
    id: "recently-played",
    name: "Recently Played",
    coverUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    tracks: [
      {
        id: "3",
        title: "Retrowave",
        artist: "Sunset Riders",
        album: "Neon Horizon",
        duration: 317,
        coverUrl:
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop",
      },
    ],
  },
  "top-songs": {
    id: "top-songs",
    name: "Top Songs",
    coverUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
    tracks: [
      {
        id: "4",
        title: "Neon Dreams",
        artist: "Synthwave Masters",
        album: "Future City",
        duration: 245,
        coverUrl:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop",
      },
    ],
  },
  favorites: {
    id: "favorites",
    name: "Favorites",
    coverUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    tracks: [],
  },
  "workout-mix": {
    id: "workout-mix",
    name: "Workout Mix",
    coverUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    tracks: [],
  },
  "chill-vibes": {
    id: "chill-vibes",
    name: "Chill Vibes",
    coverUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
    tracks: [],
  },
  "road-trip": {
    id: "road-trip",
    name: "Road Trip",
    coverUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    tracks: [],
  },
  "90s-hits": {
    id: "90s-hits",
    name: "90s Hits",
    coverUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    tracks: [],
  },
};

export function useMusicData(playlistId: string) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Replace with real API call
        await new Promise((resolve) => setTimeout(resolve, 500));
        setPlaylist(mockPlaylists[playlistId] || null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [playlistId]);

  return { playlist, isLoading };
}

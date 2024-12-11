"use client";

import { useState, useEffect } from "react";
import { Playlist } from "@/types/music";

// Mock data - replace with real API calls
const mockPlaylists: Record<number, Playlist> = {
  1: {
    id: 1,
    name: "Recently Added",
    cover_img_url:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    songs: [
      {
        content:{
          id: 1,
          title: "Midnight City",
          artist: "Neon Dreams",
          album: "Night Drive",
          duration: 272,
          pic_url:
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop",
        },
        type: "Netesae"
      },
      {
        content: {
          id: 2,
          title: "Summer Nights",
          artist: "The Midnight",
          album: "Days of Thunder",
          duration: 225,
          pic_url:
              "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60&fit=crop"
        },
        type: "Netesae"
      },
    ],
    total: 2,
  },
  2: {
    id: 2,
    name: "Recently Played",
    cover_img_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    songs: [
      {
        content: {
          id: 3,
          title: "Retrowave",
          artist: "Sunset Riders",
          album: "Neon Horizon",
          duration: 317,
          pic_url:
              "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop"
        },
        type: "Netesae"
      },
    ],
    total: 1,
  },
  3: {
    id: 3,
    name: "Top Songs",
    cover_img_url:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
    songs: [
      {
        content: {
          id: 4,
          title: "Neon Dreams",
          artist: "Synthwave Masters",
          album: "Future City",
          duration: 245,
          pic_url:
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=60&fit=crop",
        },
        type: "Netesae"

      },
    ],
    total: 1,
  },
  4: {
    id: 4,
    name: "Favorites",
    cover_img_url:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    songs: [],
    total: 0,
  },
  5: {
    id: 5,
    name: "Workout Mix",
    cover_img_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    songs: [],
    total: 0,
  },
  6: {
    id: 6,
    name: "Chill Vibes",
    cover_img_url:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
    songs: [],
    total: 0,
  },
  7: {
    id: 7,
    name: "Road Trip",
    cover_img_url:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    songs: [],
    total: 0,
  },
  8: {
    id: 8,
    name: "90s Hits",
    cover_img_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    songs: [],
    total: 0,
  },
};

export function useMusicData(playlistId: number) {
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

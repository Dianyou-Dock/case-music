import {SongInfo} from "@/types/song.ts";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
}

export interface Playlist {
  id: number;
  name: string;
  cover_img_url?: string;
  songs: SongInfo[];
}

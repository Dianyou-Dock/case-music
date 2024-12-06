export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  tracks: Track[];
}

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  album?: { name: string; release_date?: string; images?: { url: string }[] };
};

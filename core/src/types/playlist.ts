import { MusicSource } from "@/types/constants.ts";

export interface PlaylistData {
  type: MusicSource;
  content: object;
}

export interface PlaylistInfo extends PlaylistData {}

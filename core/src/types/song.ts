import { MusicSource } from "@/types/constants.ts";

type SongContent = {
  album: string;
  album_id: number;
  copyright: string;
  duration: number;
  id: number;
  name: string;
  pic_url: string;
  singer: string;
  song_url: string;
};

export interface SongInfoData {
  type: MusicSource;
  content: SongContent;
}

export interface SongInfo extends SongInfoData {}

export interface SongInfoProps {
  songInfo: SongInfo; // 定义组件接收的 songInfo 类型
}

export interface SongUrlData {
  type: MusicSource;
  content: any;
}

export interface SongUrl extends SongUrlData {}

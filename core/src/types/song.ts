import { MusicSource } from "@/types/constants.ts";

export interface SongInfoData {
  type: MusicSource;
  content: any;
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

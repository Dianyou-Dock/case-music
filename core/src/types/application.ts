import { MusicSource, SongRate } from "@/types/constants.ts";
import { SongInfo, SongUrl } from "@/types/song.ts";

/*
 * backend default resp
 * */
export interface ApplicationResp<T> {
  code: number;
  msg: string;
  data?: T;
}

/*
 * like operation
 * */
export interface LikeListReq {
  source: MusicSource;
  user_id: number;
  offset: number;
  limit: number;
}

export interface LikeSongReq {
  source: MusicSource;
  song_id: number;
  is_like: boolean;
}

/*
 * recommend operation
 * */
export interface RecommendReq {
  source: MusicSource;
  song: string;
  singer: string;
  recommend_song_count: number;
  recommend_singer_count: number;
  previous?: RecommendSongInfo[];
}

export interface RecommendSongInfo {
  name: string;
  singer: string;
}

export interface RecommendSongResp {
  song_infos: SongInfo;
  benchmark_info: BenchmarkInfo;
}

export interface BenchmarkInfo {
  song_type: string;
  song_detail: string;
  recommend_detail: string;
}

/*
 * song operation
 * */

export interface SongsUrlReq {
  source: MusicSource;
  songs: number[];
  rate: SongRate;
}

export interface SongsUrlResp {
  urls: SongUrl[];
}

/*
 * login operation
 * */

export interface LoginReq {
  source: MusicSource;
  unikey: string;
}

/*
 * collect list operation
 * */

export interface CollectListReq {
  source: MusicSource;
  user_id: number;
}

export interface ListSongReq {
  source: MusicSource;
  list_id: number;
  offset: number;
  limit: number;
}

/*
 * constants operation
 * */

export interface SourceData {
  id: string;
  name: string;
  desc: string;
}

export type SourceListResp = ApplicationResp<SourceData[]>;

export type UserSourceConfig = Record<MusicSource, boolean>;

export type UserSourceConfigRes = ApplicationResp<UserSourceConfig>;

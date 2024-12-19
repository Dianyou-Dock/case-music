export type MusicSource = "Netesae" | "Spotify" | "QQ" | "Apple";


export type AiSources = "Kimi"

export enum SongRate {
  L = "L",
  M = "M",
  H = "H",
  SQ = "SQ",
  HR = "HR",
}

// 假如一首歌平均5分钟, 24小时可以播放288首, 取个整
export const defaultLimit = 10;
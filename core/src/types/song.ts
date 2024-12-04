import {MusicSource} from "@/types/constants.ts";

export interface SongInfoData {
    type: MusicSource
    content: object
}

export interface SongInfo extends SongInfoData {}

export interface SongUrlData {
    type: MusicSource
    content: object
}

export interface SongUrl extends SongUrlData {}
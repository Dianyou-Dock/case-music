import {MusicSource} from "@/types/constants.ts";

export interface LoginQrInfo {
    url: string
    unikey: string
}

export interface LoginInfoData {
    type: MusicSource
    content: object
}

export interface LoginInfo extends LoginInfoData {}
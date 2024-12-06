import { MusicSource } from "@/types/constants.ts";

export interface LoginQrInfo {
  url: string;
  unikey: string;
}

export interface LoginInfoData {
  type: MusicSource;
  content: any;
}

export interface LoginInfo extends LoginInfoData {}


export interface LoggedData {
  logged: boolean;
  disable: boolean;
}
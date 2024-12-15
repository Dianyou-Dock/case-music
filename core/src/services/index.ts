import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application";

export const likeSong = async ({
  source,
  song_id,
  is_like,
}: {
  source: string;
  song_id: number;
  is_like: boolean;
}) => {
  return invoke<ApplicationResp<boolean>>("like_song", {
    req: {
      source,
      song_id,
      is_like,
    },
  });
};

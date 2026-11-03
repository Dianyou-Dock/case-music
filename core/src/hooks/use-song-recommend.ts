import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, RecommendReq, RecommendSongResp } from "@/types/application.ts";
import { MusicSource } from "@/types/constants.ts";
import { useTranslation } from "react-i18next";

type Props = {
  source: MusicSource | undefined;
  song: string | null;
  singer: string | null;
  request: string | null;
};

export default function useSongRecommend({ source, song, singer, request }: Props) {
  const { t } = useTranslation();
  return useSWR(
    source && song && singer
      ? ["recommend_song", source, song, singer, request]
      : null,
    async () => {
      const req: RecommendReq = {
        source: source!,
        song: song!,
        singer: singer!,
        recommend_song_count: 15,
        recommend_singer_count: 0,
      };
      const response = await invoke<ApplicationResp<RecommendSongResp>>("recommend_song", { req });
      if (response.code !== 0 || !response.data) {
        throw new Error(
          response.code === -2
            ? `${t("recommend_search_failed")}: ${response.msg}`
            : response.msg || t("recommend_failed")
        );
      }
      return response.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    }
  );
}

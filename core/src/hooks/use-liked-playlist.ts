import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { MusicSource } from "@/types/constants";

type Props = {
  source: MusicSource;
  pageIndex: number;
};

const useLikedPlaylist = ({ source, pageIndex }: Props) => {
  const { data, isLoading, mutate, error } = useSWR("like_list", () =>
    invoke("like_list", { source, offset: pageIndex, limit: 20 })
  );



  return {
    data,
    isLoading,
    mutate,
    error
  };
};

export default useLikedPlaylist;

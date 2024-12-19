"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { AudioSource } from "@/lib/audio-sources";
import { invoke } from "@tauri-apps/api/core";
import { UserSourceConfigRes, SourceListResp } from "@/types/application";
import { cloneDeep, set } from "lodash";
import { MusicSource } from "@/types/constants";

interface AudioSourceContextType {
  audioSource: AudioSource[] | null;
  configureSource: (data: AudioSource[]) => void;
  currentSource: MusicSource;
}

const AudioSourceContext = createContext<AudioSourceContextType | undefined>(
  undefined
);

const fetchSourceList = async () => {
  try {
    // fetch audio source list from server
    const res = await invoke<SourceListResp>("music_source_list", {});
    return res.data;
  } catch (error) {
    console.error(error);
  }
};

const fetchUserSourceConfig = async () => {
  try {
    // fetch audio source from server
    const res = await invoke<UserSourceConfigRes>("music_logged");
    console.log("logged: ", res);
    return res.data;
  } catch (error) {
    console.error(error);
  }
};

export function AudioSourceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [audioSource, setAudioSource] = useState<AudioSource[] | null>(null);

  const currentSource = useMemo(() => {
    // only use one source
    return audioSource?.filter((item) => item.connected)[0]?.id as MusicSource;
  }, [audioSource]);

  useEffect(() => {
    fetchSourceList().then((list) => {
      fetchUserSourceConfig().then((data) => {
        if (data && list) {
          const result = cloneDeep(list);
          Object.entries(data).forEach(([key, value]) => {
            result.forEach((source) => {
              if (source.id === key) {
                set(source, "connected", value.logged);
                set(source, "disabled", value.disable);
              }
            });
          });
          setAudioSource(result as AudioSource[]);
        }
      });
    });
  }, []);

  const configureSource = (data: AudioSource[]) => {
    if (data) {
      setAudioSource(data);
    }
  };

  return (
    <AudioSourceContext.Provider
      value={{ audioSource, configureSource, currentSource }}
    >
      {children}
    </AudioSourceContext.Provider>
  );
}

export function useAudioSource() {
  const context = useContext(AudioSourceContext);
  if (context === undefined) {
    throw new Error(
      "useAudioSource must be used within an AudioSourceProvider"
    );
  }
  return context;
}

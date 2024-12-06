"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { AudioSource } from "@/lib/audio-sources";
import { invoke } from "@tauri-apps/api/core";
import { UserSourceConfigRes, SourceListResp } from "@/types/application";
import { cloneDeep, set } from "lodash";

interface AudioSourceContextType {
  audioSource: AudioSource[] | null;
  configureSource: (data: AudioSource[]) => void;
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
    const res = await invoke<UserSourceConfigRes>("logged");
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

  useEffect(() => {
    fetchSourceList().then((list) => {
      fetchUserSourceConfig().then((data) => {
        if (data && list) {
          const result = cloneDeep(list);
          Object.entries(data).forEach(([key, value]) => {
            result.forEach((source) => {
              if (source.id === key) {
                set(source, "connected", value);
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
    <AudioSourceContext.Provider value={{ audioSource, configureSource }}>
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

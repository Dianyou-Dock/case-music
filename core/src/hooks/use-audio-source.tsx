"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { AudioSource } from "@/lib/audio-sources";

interface AudioSourceContextType {
  currentSource: AudioSource | null;
  configureSource: (data: AudioSource) => void;
}

const AudioSourceContext = createContext<AudioSourceContextType | undefined>(
  undefined
);

export function AudioSourceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentSource, setCurrentSource] = useState<AudioSource | null>(null);

  useEffect(() => {
    // fetch audio source from server
  }, []);

  const configureSource = (data: AudioSource) => {
    if (data) {
      setCurrentSource(data);
    }
  };

  return (
    <AudioSourceContext.Provider value={{ currentSource, configureSource }}>
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

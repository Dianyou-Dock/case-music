"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { AudioSource, audioSources } from "@/lib/audio-sources";

interface AudioSourceContextType {
  currentSource: AudioSource | null;
  configureSource: (sourceId: string) => void;
}

const AudioSourceContext = createContext<AudioSourceContextType | undefined>(undefined);

export function AudioSourceProvider({ children }: { children: React.ReactNode }) {
  const [currentSource, setCurrentSource] = useState<AudioSource | null>(null);

  useEffect(() => {
    const storedSourceId = localStorage.getItem("audioSource");
    if (storedSourceId) {
      const source = audioSources.find(s => s.id === storedSourceId);
      if (source) {
        setCurrentSource(source);
      }
    }
  }, []);

  const configureSource = (sourceId: string) => {
    const source = audioSources.find(s => s.id === sourceId);
    if (source) {
      setCurrentSource(source);
      localStorage.setItem("audioSource", source.id);
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
    throw new Error("useAudioSource must be used within an AudioSourceProvider");
  }
  return context;
}
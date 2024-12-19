"use client";

import { AiSource } from "@/lib/ai-source.ts";
import { createContext, useContext, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SourceListResp, UserAiSourceConfigRes } from "@/types/application.ts";
import { cloneDeep, set } from "lodash";

interface AiSourceContextType {
  aiSource: AiSource[] | null;
  configureSource: (status: boolean) => void;
}

const AiSourceContext = createContext<AiSourceContextType | undefined>(
  undefined
);

const fetchAiSourceList = async () => {
  try {
    // fetch audio source list from server
    const res = await invoke<SourceListResp>("ai_source_list", {});
    return res.data;
  } catch (error) {
    console.error(error);
  }
};

const fetchUserAiSourceConfig = async () => {
  try {
    // fetch audio source from server
    const res = await invoke<UserAiSourceConfigRes>("ai_logged");
    console.log("logged: ", res);
    return res.data;
  } catch (error) {
    console.error(error);
  }
};

export function AiSourceProvider({ children }: { children: React.ReactNode }) {
  const [aiSource, setAiSource] = useState<AiSource[] | null>(null);
  const [reset, setReset] = useState(false);

  useEffect(() => {
    fetchAiSourceList().then((list) => {
      fetchUserAiSourceConfig().then((data) => {
        if (data && list) {
          const result = cloneDeep(list);
          Object.entries(data).forEach(([key, value]) => {
            result.forEach((source) => {
              if (source.id === key) {
                set(source, "used", value.used);
                set(source, "disabled", value.disable);
              }
            });
          });
          setAiSource(result as AiSource[]);
        }
      });
    });
  }, [reset]);

  const configureSource = (status: boolean) => {
    if (status) {
      setReset(!reset);
    }
  };

  return (
    <AiSourceContext.Provider value={{ aiSource, configureSource }}>
      {children}
    </AiSourceContext.Provider>
  );
}

export function useAiSource() {
  const context = useContext(AiSourceContext);
  if (context === undefined) {
    throw new Error("useAiSource must be used within an AiSourceProvider");
  }
  return context;
}

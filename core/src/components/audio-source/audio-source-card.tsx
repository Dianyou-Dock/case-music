"use client";

import { Button } from "@/components/ui/button";
import { useAudioSource } from "@/hooks/use-audio-source";
import { cn } from "@/lib/utils";
import { AuthDialog } from "@/components/auth-dialog.tsx";
import {useEffect, useState} from "react";
import { AudioSource } from "@/lib/audio-sources";
import {invoke} from "@tauri-apps/api/core";
import {ApplicationResp} from "@/types/application.ts";

export function AudioSourceCard({ source }: { source: AudioSource }) {
  const { audioSource } = useAudioSource();
  const isSelected = audioSource?.find((s) => s.id === source.id)?.connected;
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [reload, setReload] = useState(false);

  async function logout(): Promise<ApplicationResp<any> | undefined> {
    try {
      const res = await invoke<ApplicationResp<any>>("logout", {source: source.id});
      console.log(res);
      return res
    } catch (e) {
      console.error(e);
      return undefined
    }
  }

  const handleConnectClick = () => {
    console.log("isSelected: ",isSelected);
    // 点击按钮时，打开 AuthDialog
    if (isSelected) {
      logout().then((res) => {
        if (res != undefined && res.code == 0) {
          const item = audioSource?.find((s) => s.id === source.id);
          if (item) {
            item.connected = false;
            setReload(true);
          }
        }
      });
    } else {
      setIsAuthDialogOpen(true);
    }
  };

  useEffect(() => {
    console.log("Reloading...");
  }, [reload]);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-4 transition-colors",
        isSelected && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-4">
        <div>
          <h3 className="font-medium">{source.name}</h3>
          <p className="text-sm text-muted-foreground">{source.desc}</p>
        </div>
      </div>
      <Button
        variant={isSelected ? "default" : "outline"}
        onClick={handleConnectClick}
      >
        {isSelected ? "Connected" : "Connect"}
      </Button>
      <AuthDialog
        isOpen={isAuthDialogOpen}
        setIsOpen={setIsAuthDialogOpen}
        source={source}
      />
    </div>
  );
}

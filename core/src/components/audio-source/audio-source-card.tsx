"use client";

import { Button } from "@/components/ui/button";
import { useAudioSource } from "@/hooks/use-audio-source";
import { cn } from "@/lib/utils";
import { AuthDialog } from "@/components/auth-dialog.tsx";
import { useState } from "react";
import { AudioSource } from "@/lib/audio-sources";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";
import {useTranslation} from "react-i18next";
import { useEffect } from "react";

export function AudioSourceCard({ source }: { source: AudioSource }) {
  const { audioSource, configureSource } = useAudioSource();
  const isSelected = audioSource?.find((s) => s.id === source.id)?.connected;
  const disabled = audioSource?.find((s) => s.id === source.id)?.disabled;
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [spotifyPending, setSpotifyPending] = useState(false);
  const [spotifyError, setSpotifyError] = useState("");
  const [streamingAuthorized, setStreamingAuthorized] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (source.id !== "Spotify" || !audioSource) return;
    void invoke<ApplicationResp<{ connected: boolean; streaming_authorized: boolean }>>("spotify_status")
      .then((response) => {
        setStreamingAuthorized(Boolean(response.data?.streaming_authorized));
        if (response.data?.connected && response.data.streaming_authorized && !isSelected) {
          configureSource(audioSource.map((item) => item.id === "Spotify" ? { ...item, connected: true } : item));
        }
      })
      .catch(() => {});
  }, [source.id, isSelected, audioSource, configureSource]);

  useEffect(() => {
    if (!spotifyPending) return;
    const checkStatus = async () => {
      try {
        const response = await invoke<ApplicationResp<{ connected: boolean; streaming_authorized: boolean; authorization_error?: string | null }>>("spotify_status");
        if (response.data?.connected && response.data.streaming_authorized) {
          configureSource((audioSource ?? []).map((item) => item.id === "Spotify" ? { ...item, connected: true } : item));
          setStreamingAuthorized(true);
          setSpotifyPending(false);
          if (isSelected) window.location.reload();
        } else if (response.data?.authorization_error) {
          setSpotifyError(response.data.authorization_error);
          setSpotifyPending(false);
        }
      } catch (error) {
        setSpotifyError(String(error));
        setSpotifyPending(false);
      }
    };
    const onReturn = () => {
      if (document.visibilityState === "visible") void checkStatus();
    };
    const timer = setInterval(checkStatus, 2000);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [spotifyPending, audioSource, configureSource, isSelected]);

  async function logout(): Promise<ApplicationResp<any> | undefined> {
    try {
      const res = await invoke<ApplicationResp<any>>("logout", {
        source: source.id,
      });
      console.log(res);
      return res;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  const handleConnectClick = async () => {
    // 点击按钮时，打开 AuthDialog
    if (isSelected) {
      logout().then((res) => {
        if (res != undefined && res.code == 0) {
          // update current audio source connect status
          const newSource = audioSource?.map((s) => {
            if (s.id === source.id) {
              return { ...s, connected: false };
            }
            return s;
          });
          configureSource(newSource);
        }
      });
    } else if (source.id === "Spotify") {
      await startSpotifyAuthorization();
    } else {
      setIsAuthDialogOpen(true);
    }
  };

  const startSpotifyAuthorization = async () => {
    setSpotifyError("");
    try {
      const response = await invoke<ApplicationResp<string>>("spotify_auth_start");
      if (!response.data) throw new Error(response.msg || "Could not start Spotify authorization");
      setSpotifyPending(true);
      await invoke("spotify_auth_open", { url: response.data });
    } catch (error) {
      setSpotifyPending(false);
      setSpotifyError(String(error));
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
        isSelected && "border-primary bg-primary/5"
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{source.name}</h3>
          <p className="break-words text-sm text-muted-foreground">
            {t("setting_music_card_desc", { name: source.name })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {source.id === "Spotify" && isSelected && !streamingAuthorized && (
            <Button variant="outline" disabled={spotifyPending} onClick={startSpotifyAuthorization}>
              {spotifyPending ? t("spotify_waiting") : t("spotify_reauthorize")}
            </Button>
          )}
          <Button
        variant={isSelected ? "outline" : "default"}
        onClick={handleConnectClick}
        disabled={disabled || spotifyPending}
        className={cn(
          "w-fit gap-2 bg-transparent border-2 text-green-500 hover:bg-green-100", // Green border and text
          isSelected && "border-green-500 text-green-500" // When selected, green border and text
        )}
          >
            {spotifyPending ? t("spotify_waiting") : isSelected ? t("disconnect") : t("connect")}
          </Button>
        </div>
      </div>

      {spotifyError && <p role="alert" className="text-sm text-destructive">{spotifyError}</p>}

      <AuthDialog
        isOpen={isAuthDialogOpen}
        setIsOpen={setIsAuthDialogOpen}
        source={source}
      />
    </div>
  );
}

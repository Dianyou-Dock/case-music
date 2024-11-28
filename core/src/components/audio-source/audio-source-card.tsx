"use client";

import { AudioSource } from "@/lib/audio-sources";
import { Button } from "@/components/ui/button";
import { useAudioSource } from "@/hooks/use-audio-source";
import { cn } from "@/lib/utils";

interface AudioSourceCardProps {
  source: AudioSource;
}

export function AudioSourceCard({ source }: AudioSourceCardProps) {
  const { currentSource, configureSource } = useAudioSource();
  const isSelected = currentSource?.id === source.id;

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
          <p className="text-sm text-muted-foreground">{source.description}</p>
        </div>
      </div>
      <Button
        variant={isSelected ? "default" : "outline"}
        onClick={() => configureSource(source.id)}
      >
        {isSelected ? "Connected" : "Connect"}
      </Button>
    </div>
  );
}

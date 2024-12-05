"use client";

import { Button } from "@/components/ui/button";
import { useAudioSource } from "@/hooks/use-audio-source";
import { cn } from "@/lib/utils";
import { DisplayDataProps } from "@/types/application.ts";
import { AuthDialog } from "@/components/auth-dialog.tsx";
import { useState } from "react";

export function AudioSourceCard({ source }: DisplayDataProps) {
  const { currentSource } = useAudioSource();
  const isSelected = currentSource?.id === source.id;
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  
  const handleConnectClick = () => {
    // 点击按钮时，打开 AuthDialog
    setIsAuthDialogOpen(true);
  };

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

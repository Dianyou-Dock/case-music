"use client";

import { AiSource } from "@/lib/ai-source.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { useAiSource } from "@/hooks/use-ai-source.tsx";
import { useState } from "react";
import { AiDialog } from "@/components/ai-dialog.tsx";
import {useTranslation} from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";

export function AiSourceCard({ source }: { source: AiSource }) {
  const { aiSource, configureSource } = useAiSource();
  const current = aiSource?.find((s) => s.id === source.id);
  const isSelected = current?.used;
  const disabled = current?.disabled;
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleConnectClick = async () => {
    if (isSelected) return;
    setError("");
    if (!current?.configured) {
      setIsAiDialogOpen(true);
      return;
    }
    setIsSwitching(true);
    try {
      const response = await invoke<ApplicationResp<void>>("select_ai_source", { source: source.id });
      if (response.code !== 0) throw new Error(response.msg || t("ai_switch_failed"));
      configureSource(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-4 transition-colors",
        isSelected && "border-primary bg-primary/5"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div>
          <h3 className="font-medium">{source.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t("setting_ai_card_desc", { name: source.name })}
          </p>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>

      <div className="flex flex-col items-end gap-2">
        <Button
        variant={isSelected ? "outline" : "default"}
        onClick={handleConnectClick}
        disabled={disabled || isSelected || isSwitching}
        className={cn(
          "w-fit gap-2 bg-transparent border-2 text-green-500 hover:bg-green-100", // Green border and text
          isSelected && "border-green-500 text-green-500" // When selected, green border and text
        )}
      >
        {isSelected ? t("used") : isSwitching ? t("ai_switching") : t("use")}
      </Button>
        {current?.configured && (
          <Button variant="ghost" size="sm" onClick={() => setIsAiDialogOpen(true)}>
            {t("ai_update_key")}
          </Button>
        )}
      </div>

      <AiDialog
        isOpen={isAiDialogOpen}
        setIsOpen={setIsAiDialogOpen}
        source={source}
      />
    </div>
  );
}

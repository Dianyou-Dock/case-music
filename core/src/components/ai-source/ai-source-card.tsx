"use client";

import { AiSource } from "@/lib/ai-source.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { useAiSource } from "@/hooks/use-ai-source.tsx";
import { useState } from "react";
import { AiDialog } from "@/components/ai-dialog.tsx";
import {useTranslation} from "react-i18next";

export function AiSourceCard({ source }: { source: AiSource }) {
  const { aiSource, configureSource } = useAiSource();
  const isSelected = aiSource?.find((s) => s.id === source.id)?.used;
  const disabled = aiSource?.find((s) => s.id === source.id)?.disabled;
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const { t } = useTranslation();

  // TODO: 这里要做互斥, 只能有一个ai源被使用
  const handleConnectClick = () => {
    if (isSelected) {
      console.log(configureSource);
      setIsAiDialogOpen(false);
    } else {
      setIsAiDialogOpen(true);
    }
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
          <p className="text-sm text-muted-foreground">
            {t("setting_ai_card_desc", { name: source.name })}
          </p>
        </div>
      </div>

      <Button
        variant={isSelected ? "outline" : "default"}
        onClick={handleConnectClick}
        disabled={disabled}
        className={cn(
          "w-fit gap-2 bg-transparent border-2 text-green-500 hover:bg-green-100", // Green border and text
          isSelected && "border-green-500 text-green-500" // When selected, green border and text
        )}
      >
        {isSelected ? t("used") : t("use")}
      </Button>

      <AiDialog
        isOpen={isAiDialogOpen}
        setIsOpen={setIsAiDialogOpen}
        source={source}
      />
    </div>
  );
}

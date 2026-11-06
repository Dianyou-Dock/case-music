"use client";

import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateRecommendationButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <Button
    variant="outline"
    size="lg"
    className="gap-2 border-2 border-purple-500 bg-transparent text-purple-500 hover:bg-purple-500/10 hover:text-purple-400"
    onClick={onClick}
    disabled={disabled}
  >
    <WandSparkles className="h-5 w-5" />{label}
  </Button>;
}

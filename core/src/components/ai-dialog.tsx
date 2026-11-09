"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp } from "@/types/application.ts";
import { AiSource } from "@/lib/ai-source.ts";
import { useAiSource } from "@/hooks/use-ai-source";
import {useTranslation} from "react-i18next";
import { useState } from "react";

export function AiDialog({
  isOpen,
  setIsOpen,
  source,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  source: AiSource;
}) {
  const { configureSource } = useAiSource();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    defaultValues: {
      apikey: "",
    },
  });

  async function onSubmit(value: { apikey: string }) {
    setError("");
    if (!value.apikey.trim()) {
      setError(t("ai_key_required"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await invoke<ApplicationResp<void>>("set_api_key", {
        req: { source: source.id, api_key: value.apikey.trim() },
      });
      if (res.code !== 0) throw new Error(res.msg || t("ai_save_failed"));
      form.reset();
      setIsOpen(false);
      configureSource(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("ai_apikey_title")}</DialogTitle>
          <DialogDescription>{t("ai_apikey_desc")}</DialogDescription>
          {source.id === "ChatGPT" && <p className="text-sm text-muted-foreground">{t("ai_chatgpt_key_hint")}</p>}
          {source.id === "Cursor" && <p className="text-sm text-muted-foreground">{t("ai_cursor_key_hint")}</p>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apikey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ApiKey</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="off" placeholder={t("ai_apikey_input_desc")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isSaving}>{isSaving ? t("ai_saving") : t("submit")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

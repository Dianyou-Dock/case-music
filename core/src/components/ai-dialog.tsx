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

  const form = useForm({
    defaultValues: {
      apikey: "",
    },
  });

  async function onSubmit(value: { apikey: string }) {
    try {
      const res = await invoke<ApplicationResp<any>>("set_api_key", {
        req: { source: source.id, api_key: value.apikey },
      });
      console.log("set api key res", res);
      if (res) {
        if (res.code == 0) {
          setIsOpen(false);
          configureSource(true);
          console.log("set apikey success");
        }
      }
    } catch (err) {
      console.log("set api key err: ", err);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("ai_apikey_title")}</DialogTitle>
          <DialogDescription>{t("ai_apikey_desc")}</DialogDescription>
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
                    <Input placeholder={t("ai_apikey_input_desc")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

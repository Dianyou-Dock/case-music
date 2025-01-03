"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { MusicSource } from "@/types/constants";
import { LoginQrInfo } from "@/types/login.ts";
import { invoke } from "@tauri-apps/api/core";
import { ApplicationResp, LoginReq } from "@/types/application.ts";
import { useAudioSource } from "@/hooks/use-audio-source";
import { AudioSource } from "@/lib/audio-sources";
import {useTranslation} from "react-i18next";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export function AuthDialog({
  isOpen,
  setIsOpen,
  source,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  source: AudioSource;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { signIn, signUp } = useAuth();
  const [loginQrInfo, setLoginQrInfo] = useState<LoginQrInfo | undefined>(
    undefined
  );
  const [selectedTab, setSelectedTab] = useState("credentials");
  const { configureSource, audioSource } = useAudioSource();
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (mode === "login") {
      await signIn(values);
    } else {
      await signUp(values);
    }
    setIsOpen(false);
  }

  async function fetchQrInfo(): Promise<LoginQrInfo | undefined> {
    try {
      const res = await invoke<ApplicationResp<any>>("get_qr", {
        source: source.id,
      });
      if (res.data !== undefined) {
        console.log("fetch qr info success");
        const info = res.data as LoginQrInfo;
        return info;
      }
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async function qrLoginCheck(info: LoginQrInfo) {
    console.log("checking qr login");
    const req: LoginReq = {
      source: source.id as MusicSource,
      unikey: info.unikey,
    };
    try {
      const res = await invoke<ApplicationResp<any>>("login_by_qr", {
        req: req,
      });
      if (res.code == 0) {
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (selectedTab === "qr") {
      fetchQrInfo().then((info) => {
        setLoginQrInfo(info);
      });
    }
  }, [selectedTab]);

  useEffect(() => {
    let key: NodeJS.Timeout;
    if (isOpen && selectedTab === "qr") {
      key = setInterval(() => {
        if (loginQrInfo) {
          qrLoginCheck(loginQrInfo).then((isSuccess) => {
            if (isSuccess) {
              // default operation
              setLoginQrInfo(undefined)
              setSelectedTab("credentials");
              clearInterval(key);
              setIsOpen(false);
              configureSource([
                ...(audioSource?.map((s) =>
                  s.id === source.id ? { ...s, connected: true } : s
                ) || []),
              ]);
            }
          });
        }
      }, 2000);
    }
    return () => {
      clearInterval(key);
    }
  }, [loginQrInfo, selectedTab, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? t("welcome") : t("create_account")}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? t("login_desc")
              : t("create_desc")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="qr"
          className="w-full"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr">{t("qr")}</TabsTrigger>
            <TabsTrigger value="credentials">{t("credentials")}</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("input_email_desc")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("input_password_desc")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-2">
                  <Button type="submit">
                    {mode === "login" ? t("login") : t("register")}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() =>
                      setMode(mode === "login" ? "register" : "login")
                    }
                  >
                    {mode === "login"
                      ?  t("submit_login_desc")
                      : t("submit_create_desc")}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="qr" className="flex flex-col items-center gap-4">
            <div className="rounded-xl border bg-card p-4">
              <QRCodeSVG
                value={loginQrInfo?.url || ""}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t("qr_desc")}
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

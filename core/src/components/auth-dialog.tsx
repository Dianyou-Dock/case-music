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
  const [qrLoading, setQrLoading] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [qrRetry, setQrRetry] = useState(0);
  const [selectedTab, setSelectedTab] = useState("qr");
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

  async function qrLoginCheck(info: LoginQrInfo) {
    const req: LoginReq = {
      source: source.id as MusicSource,
      unikey: info.unikey,
    };
    try {
      const res = await invoke<ApplicationResp<any>>("login_by_qr", {
        req: req,
      });
      if (res.code == 0) {
        return "success";
      }
      if (res.code === -100) {
        return "expired";
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!isOpen || selectedTab !== "qr") return;
    let active = true;
    setLoginQrInfo(undefined);
    setQrFailed(false);
    setQrLoading(true);
    invoke<ApplicationResp<LoginQrInfo>>("get_qr", { source: source.id })
      .then((res) => {
        if (!active) return;
        if (res.code === 0 && res.data?.url && res.data?.unikey) {
          setLoginQrInfo(res.data);
        } else {
          setQrFailed(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load login QR code", error);
        if (active) setQrFailed(true);
      })
      .finally(() => {
        if (active) setQrLoading(false);
      });
    return () => { active = false; };
  }, [isOpen, selectedTab, source.id, qrRetry]);

  useEffect(() => {
    if (isOpen && selectedTab === "qr" && loginQrInfo) {
      let checking = false;
      const key = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          const result = await qrLoginCheck(loginQrInfo);
          if (result === "expired") {
            setQrRetry((retry) => retry + 1);
          } else if (result === "success") {
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
        } finally {
          checking = false;
        }
      }, 2000);
      return () => clearInterval(key);
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
            {loginQrInfo ? (
              <>
                <div className="rounded-xl border bg-card p-4">
                  <QRCodeSVG value={loginQrInfo.url} size={200} level="H" includeMargin />
                </div>
                <p className="text-center text-sm text-muted-foreground">{t("qr_desc")}</p>
              </>
            ) : qrLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{t("qr_loading")}</p>
            ) : qrFailed ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-center text-sm text-muted-foreground">{t("qr_load_failed")}</p>
                <Button type="button" onClick={() => setQrRetry((retry) => retry + 1)}>{t("qr_retry")}</Button>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

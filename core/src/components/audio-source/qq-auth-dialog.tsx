"use client";

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationResp } from "@/types/application";

type Props = { isOpen: boolean; setIsOpen: (open: boolean) => void; onConnected: () => void };

export function QqAuthDialog({ isOpen, setIsOpen, onConnected }: Props) {
  const { t } = useTranslation();
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("waiting_scan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const polling = useRef(false);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setQr("");
    setError("");
    setStatus("waiting_scan");
    setLoading(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const start = Promise.race([
      invoke<ApplicationResp<string>>("qq_login_start"),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("获取 QQ 音乐二维码超时，请重试")), 25000);
      }),
    ]);
    void start
      .then((response) => {
        if (!active) return;
        if (response.code !== 0 || !response.data) throw new Error(response.msg || "无法获取登录二维码");
        if (!response.data.startsWith("data:image/")) throw new Error("QQ 音乐返回了无效二维码");
        setQr(response.data);
      })
      .catch((cause) => { if (active) setError(String(cause)); })
      .finally(() => { if (timeout) clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; if (timeout) clearTimeout(timeout); };
  }, [isOpen, attempt]);

  useEffect(() => {
    if (!isOpen || !qr) return;
    let active = true;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const response = await invoke<ApplicationResp<string>>("qq_login_poll");
        if (!active) return;
        if (response.code !== 0 || !response.data) throw new Error(response.msg || "登录状态查询失败");
        setStatus(response.data);
        if (response.data === "connected") { setIsOpen(false); onConnectedRef.current(); }
        else if (response.data === "expired") { setQr(""); setAttempt((value) => value + 1); }
      } catch (cause) {
        if (active) { setError(String(cause)); setQr(""); }
      } finally { polling.current = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => { active = false; clearInterval(timer); };
  }, [isOpen, qr, setIsOpen]);

  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{t("welcome")}</DialogTitle>
        <DialogDescription>{t("login_desc")}</DialogDescription>
      </DialogHeader>
      <Tabs value="qr" className="w-full">
        <TabsList className="grid w-full grid-cols-1"><TabsTrigger value="qr">{t("qr")}</TabsTrigger></TabsList>
        <TabsContent value="qr" className="flex flex-col items-center gap-4">
          {qr ? <>
            <div className="rounded-xl border bg-card p-4"><img src={qr} alt="QQ 音乐登录二维码" width={200} height={200} /></div>
            <p className="text-center text-sm text-muted-foreground">{status === "waiting_confirm" ? "请在手机上确认登录" : "请使用 QQ 音乐扫码登录"}</p>
          </> : loading ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">{t("qr_loading")}</p> : error ? <div role="alert" className="flex flex-col items-center gap-3 py-12"><p className="text-center text-sm text-destructive">{error}</p><Button type="button" onClick={() => setAttempt((value) => value + 1)}>{t("qr_retry")}</Button></div> : null}
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>;
}

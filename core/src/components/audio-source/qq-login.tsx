"use client";

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ApplicationResp } from "@/types/application";

export function QqLogin({ onConnected }: { onConnected: () => void }) {
  const [qr, setQr] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const polling = useRef(false);

  useEffect(() => {
    if (!qr || state === "expired") return;
    let disposed = false;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const response = await invoke<ApplicationResp<string>>("qq_login_poll");
        if (disposed) return;
        const next = response.data ?? "";
        setState(next);
        if (next === "connected") { setQr(""); onConnected(); }
      } catch (cause) {
        if (!disposed) { setError(String(cause)); setQr(""); }
      } finally { polling.current = false; }
    };
    const timer = setInterval(() => void poll(), 2500);
    return () => { disposed = true; clearInterval(timer); };
  }, [qr, state, onConnected]);

  const start = async () => {
    setError(""); setState("waiting_scan"); setPending(true);
    try {
      const response = await invoke<ApplicationResp<string>>("qq_login_start");
      if (!response.data) throw new Error(response.msg || "无法获取登录二维码");
      setQr(response.data);
    } catch (cause) { setError(String(cause)); }
    finally { setPending(false); }
  };

  return <div className="space-y-3">
    <Button type="button" variant="outline" disabled={pending} onClick={() => void start()}>{pending ? "正在获取二维码…" : qr ? "重新获取二维码" : "扫码登录 QQ 音乐"}</Button>
    {qr && <div className="w-fit rounded-lg bg-white p-3 text-black"><img src={qr} alt="QQ 音乐登录二维码" className="h-44 w-44" /><p className="mt-2 text-center text-sm">{state === "waiting_confirm" ? "请在手机上确认登录" : "请使用 QQ 音乐扫码"}</p></div>}
    {state === "expired" && <p className="text-sm text-muted-foreground">二维码已过期，请重新获取。</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

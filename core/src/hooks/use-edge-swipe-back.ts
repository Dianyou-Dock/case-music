import { useEffect, useRef, type TouchEvent } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";

/** Close a full-screen panel when a horizontal swipe begins at either edge. */
export function useEdgeSwipeBack(onBack: () => void, open: boolean) {
  const start = useRef<{ x: number; y: number; edge: "left" | "right" } | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!open || !isTauri() || !/Android/i.test(navigator.userAgent)) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void onBackButtonPress(() => onBackRef.current())
      .then((listener) => {
        if (disposed) void listener.unregister();
        else unsubscribe = () => { void listener.unregister(); };
      })
      .catch((error) => console.warn("Could not register Android back button", error));
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [open]);

  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      if (event.touches.length !== 1) return;
      const { clientX: x, clientY: y } = event.touches[0];
      const edge = x <= 36 ? "left" : x >= window.innerWidth - 36 ? "right" : null;
      start.current = edge ? { x, y, edge } : null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current;
      start.current = null;
      if (!origin || event.changedTouches.length !== 1) return;
      const { clientX, clientY } = event.changedTouches[0];
      const horizontal = clientX - origin.x;
      const vertical = Math.abs(clientY - origin.y);
      const inward = origin.edge === "left" ? horizontal : -horizontal;
      if (inward >= 64 && inward > vertical * 1.5) onBack();
    },
    onTouchCancel() { start.current = null; },
  };
}

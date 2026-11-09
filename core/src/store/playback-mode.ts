"use client";

import { useSyncExternalStore } from "react";

export type PlaybackMode = "list-once" | "list-loop" | "single-loop" | "shuffle";

const modes: PlaybackMode[] = ["list-once", "list-loop", "single-loop", "shuffle"];
const key = "case-music:playback-mode:v1";
const listeners = new Set<() => void>();
let current: PlaybackMode = "list-once";
let initialized = false;

function readMode(): PlaybackMode {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    const saved = window.localStorage.getItem(key);
    if (modes.includes(saved as PlaybackMode)) current = saved as PlaybackMode;
  }
  return current;
}

export function getPlaybackMode(): PlaybackMode { return readMode(); }
export function setPlaybackMode(mode: PlaybackMode) {
  readMode();
  if (current === mode) return;
  current = mode;
  try { window.localStorage.setItem(key, mode); } catch { /* Keep the mode for this session. */ }
  listeners.forEach(listener => listener());
}
export function usePlaybackMode(): PlaybackMode {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, readMode, () => "list-once");
}
export function cyclePlaybackMode() {
  const mode = getPlaybackMode();
  setPlaybackMode(modes[(modes.indexOf(mode) + 1) % modes.length]);
}
export function nextQueueIndex(index: number, length: number, mode: PlaybackMode, automatic = false): number {
  if (length <= 0 || index < 0) return -1;
  if (automatic && mode === "single-loop") return index;
  if (mode === "shuffle") return length === 1 ? index : (index + 1 + Math.floor(Math.random() * (length - 1))) % length;
  if (index + 1 < length) return index + 1;
  return mode === "list-loop" ? 0 : -1;
}
export function previousQueueIndex(index: number, length: number, mode: PlaybackMode): number {
  if (length <= 0 || index < 0) return -1;
  if (mode === "shuffle") return length === 1 ? index : (index + 1 + Math.floor(Math.random() * (length - 1))) % length;
  if (index > 0) return index - 1;
  return mode === "list-loop" ? length - 1 : -1;
}

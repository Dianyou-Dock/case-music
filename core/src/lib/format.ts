export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60000);
  const remainingSeconds = Math.floor((seconds % 60000) / 1000);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatProgress(seconds: number): string {
  const roundedSeconds = Math.round(seconds); // 四舍五入
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60000);
  const remainingSeconds = Math.floor((seconds % 60000) / 1000);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

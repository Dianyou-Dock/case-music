"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function PlaylistSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-in fade-in-50">
      <div className="flex items-end gap-6">
        <Skeleton className="h-48 w-48 rounded-lg" />
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 px-4 py-2 text-sm text-muted-foreground">
          <div className="w-[40px]">#</div>
          <div className="flex-1">Title</div>
          <div className="hidden md:block flex-1">Artist</div>
          <div className="hidden md:block flex-1">Album</div>
          <div className="w-[100px]">Duration</div>
          <div className="w-[100px]"></div>
        </div>

        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-md px-4 py-2"
          >
            <div className="w-[40px] text-muted-foreground">
              {(index + 1).toString().padStart(2, "0")}
            </div>
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="hidden md:block flex-1">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="hidden md:block flex-1">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="w-[100px]">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex w-[100px] items-center justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

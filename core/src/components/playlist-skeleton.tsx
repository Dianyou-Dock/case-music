"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function PlaylistSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 animate-in fade-in-50">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        <Skeleton className="h-40 w-40 md:h-48 md:w-48 rounded-lg mx-auto md:mx-0" />
        <div className="flex flex-col gap-4 text-center md:text-left">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 md:w-64 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-24 md:w-32 mx-auto md:mx-0" />
          </div>
          <Skeleton className="h-10 w-28 md:w-32 mx-auto md:mx-0" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="hidden md:flex items-center gap-4 px-4 py-2 text-sm text-muted-foreground">
          <div className="w-[40px]">#</div>
          <div className="flex-1">Title</div>
          <div className="flex-1">Artist</div>
          <div className="flex-1">Album</div>
          <div className="w-[100px]">Duration</div>
          <div className="w-[100px]"></div>
        </div>

        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-md px-4 py-2"
          >
            <div className="w-[40px] text-muted-foreground">
              
            </div>
            <div className="flex flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-10 w-10 rounded flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-4 w-full max-w-[200px]" />
                  <Skeleton className="h-3 w-24 mt-1 md:hidden" />
                </div>
              </div>
            </div>
            <div className="hidden md:block flex-1">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="hidden md:block flex-1">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="hidden sm:block w-[100px]">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center justify-end gap-2 w-[100px]">
              <Skeleton className="h-8 w-8 rounded-full hidden sm:block" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full hidden sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
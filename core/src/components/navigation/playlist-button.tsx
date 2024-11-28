"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PlaylistButtonProps {
  name: string;
}

export function PlaylistButton({ name }: PlaylistButtonProps) {
  const pathname = usePathname();
  const href = `/playlist/${name.toLowerCase().replace(/ /g, "-")}`;
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
    >
      {name}
    </Link>
  );
}

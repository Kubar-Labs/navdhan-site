"use client";

import Image from "next/image";
import { cn } from "@/src/lib/utils/cn";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
  priority?: boolean;
}

export function Logo({ className, priority = false }: LogoProps) {
  return (
    <Image
      src="/assets/logos/navdhan-wordmark.webp"
      alt="NavDhan"
      width={160}
      height={80}
      className={cn("h-10 w-auto object-contain", className)}
      priority={priority}
    />
  );
}

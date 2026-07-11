"use client";

import Image from "next/image";
import { cn } from "@/src/lib/utils/cn";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/assets/logos/NavDhan.png"
      alt="NavDhan"
      width={160}
      height={40}
      className={cn("h-8 w-auto object-contain", className)}
      priority
    />
  );
}

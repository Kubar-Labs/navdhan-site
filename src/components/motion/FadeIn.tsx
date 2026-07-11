"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";
import { cn } from "@/src/lib/utils/cn";

export interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  amount?: number;
  direction?: "up" | "down" | "left" | "right";
}

const directionOffsets = {
  up: { y: 16, x: 0 },
  down: { y: -16, x: 0 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
};

export function FadeIn({
  children,
  className,
  delay = 0,
  once = true,
  amount = 0.2,
  direction = "up",
}: FadeInProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const offset = directionOffsets[direction];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (reduced || !mounted) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 0.1, 0.22, 1] as [number, number, number, number],
      }}
    >
      {children}
    </motion.div>
  );
}

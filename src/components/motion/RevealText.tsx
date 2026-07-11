"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";
import { cn } from "@/src/lib/utils/cn";

export interface RevealTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  delay?: number;
  stagger?: number;
}

export function RevealText({
  text,
  as: Tag = "span",
  className,
  delay = 0,
  stagger = 0.04,
}: RevealTextProps) {
  const reduced = useReducedMotion();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const words = text.split(" ");

  if (reduced) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={cn("inline-block", className)} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={index}
          className="inline-block overflow-hidden align-bottom"
          style={{ marginRight: "0.25em" }}
        >
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "110%" }}
            animate={animate ? { y: 0 } : { y: "110%" }}
            transition={{
              duration: 0.65,
              delay: delay + index * stagger,
              ease: [0.22, 0.1, 0.22, 1] as [number, number, number, number],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

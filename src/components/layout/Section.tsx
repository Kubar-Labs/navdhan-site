import { cn } from "@/src/lib/utils/cn";

export interface SectionProps {
  children: React.ReactNode;
  as?: "section" | "div" | "article";
  id?: string;
  background?: "white" | "cream" | "dark";
  padding?: "default" | "tight" | "none";
  className?: string;
}

const backgroundClasses = {
  white: "bg-white",
  cream: "bg-[#FAFAF8]",
  dark: "bg-[#0A0A0A]",
};

const paddingClasses = {
  default: "py-20 md:py-28",
  tight: "py-8",
  none: "py-0",
};

export function Section({
  children,
  as: Component = "section",
  id,
  background = "white",
  padding = "default",
  className,
}: SectionProps) {
  return (
    <Component
      id={id}
      className={cn(backgroundClasses[background], paddingClasses[padding], className)}
    >
      {children}
    </Component>
  );
}

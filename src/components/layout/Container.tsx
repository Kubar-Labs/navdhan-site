import { cn } from "@/src/lib/utils/cn";

export interface ContainerProps {
  children: React.ReactNode;
  size?: "default" | "legal" | "full";
  className?: string;
}

const sizeClasses = {
  default: "max-w-[1280px]",
  legal: "max-w-[1024px]",
  full: "max-w-none",
};

export function Container({ children, size = "default", className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizeClasses[size], className)}>
      {children}
    </div>
  );
}

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Brex system: a single ember fill, plus mist-outline and ghost.
        default: "bg-ember text-white hover:bg-ember-hover",
        ember: "bg-ember text-white hover:bg-ember-hover",
        outline: "border border-mist bg-paper text-ink hover:border-ink",
        "outline-light": "border border-white/25 bg-transparent text-white hover:bg-white hover:text-ink",
        ghost: "text-ink hover:text-ember",
        "ghost-light": "text-white/80 hover:text-white",
        link: "text-ember underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-fog text-ink hover:bg-mist/60",
        // Legacy aliases kept so any stray call site still resolves to the ember system.
        orange: "bg-ember text-white hover:bg-ember-hover",
        green: "bg-ember text-white hover:bg-ember-hover",
        blue: "bg-ember text-white hover:bg-ember-hover",
        "outline-orange": "border border-mist bg-paper text-ink hover:border-ink",
        "outline-blue": "border border-mist bg-paper text-ink hover:border-ink",
        ink: "bg-ink text-white hover:bg-ink/90",
        gold: "bg-ember text-white hover:bg-ember-hover",
        "outline-ink": "border border-mist bg-paper text-ink hover:border-ink",
        "outline-cream": "border border-white/25 bg-transparent text-white hover:bg-white hover:text-ink",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3.5 text-[13px]",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

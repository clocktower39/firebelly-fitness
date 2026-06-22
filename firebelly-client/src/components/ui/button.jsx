import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button, brand-tuned for Firebelly.
 *
 * - `default` carries the brand emerald sheen (matches MUI `containedPrimary`)
 *   so shadcn and MUI primary buttons read identically during the migration.
 * - `flame` exposes the amber accent for deliberate emphasis only
 *   (see DESIGN.md "The Rationed Flame Rule").
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-offset-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(45deg,#10b981_30%,#34d399_90%)] text-primary-foreground hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]",
        flame:
          "bg-brand-flame text-brand-flame-foreground hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[22px] py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-11 rounded-md px-7 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

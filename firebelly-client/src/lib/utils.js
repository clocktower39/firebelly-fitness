import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind-aware conflict resolution.
 * Standard shadcn/ui helper used by every generated component.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

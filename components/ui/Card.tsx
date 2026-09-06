import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Density = "compact" | "default" | "hero";

// Spec §6: 12px radius for dense data, 16px standard, 20px major hero surfaces;
// 16–28px padding depending on density.
const DENSITY: Record<Density, string> = {
  compact: "rounded-lg p-4",
  default: "rounded-xl p-5",
  hero: "rounded-2xl p-7",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  density?: Density;
  /** Adds hover elevation + cursor affordance. Only for cards that are actually clickable. */
  interactive?: boolean;
  /** Elevation. Default is a hairline border with no shadow — cards group information,
   *  they are not decoration (spec §2). Opt into `raised` for genuinely floating surfaces. */
  elevation?: "flat" | "raised";
}

export function Card({
  className,
  density = "default",
  interactive = false,
  elevation = "flat",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "border border-hairline bg-panel",
        DENSITY[density],
        elevation === "raised" && "shadow-md",
        interactive &&
          "cursor-pointer transition-all duration-hover ease-out hover:border-hairline-strong hover:shadow-md",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-xs text-slate", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4", className)}
      {...props}
    />
  );
}

// FILE: BrandMark.tsx
// Purpose: Theme-swapped light/dark PNG brand mark used by Quack and Studio logos.
// Layer: Shared app branding primitive

import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

type BrandMarkProps = HTMLAttributes<HTMLSpanElement> & {
  lightSrc: string;
  darkSrc: string;
  "aria-label"?: string;
};

export function BrandMark({ lightSrc, darkSrc, className, ...props }: BrandMarkProps) {
  const ariaLabel = props["aria-label"];
  const showLabel = Boolean(ariaLabel);

  return (
    <span
      {...props}
      className={cn(
        "relative inline-grid shrink-0 [&>img]:col-start-1 [&>img]:row-start-1 [&>img]:h-full [&>img]:w-full [&>img]:object-contain",
        className,
      )}
      role={showLabel ? "img" : undefined}
      aria-label={showLabel ? ariaLabel : undefined}
      aria-hidden={showLabel ? undefined : true}
    >
      {/* Light UI: dark mark, transparent background */}
      <img src={lightSrc} alt="" draggable={false} className="dark:hidden" />
      {/* Dark UI: light mark, transparent background */}
      <img src={darkSrc} alt="" draggable={false} className="hidden dark:block" />
    </span>
  );
}

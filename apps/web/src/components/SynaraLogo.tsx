// FILE: SynaraLogo.tsx
// Purpose: Render the Quack mark PNG, swapping light/dark assets with the theme.
// Layer: Shared app branding primitive

import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

const QUACK_LOGO_DARK_SRC = "/synara.png";
const QUACK_LOGO_LIGHT_SRC = "/synara-light.png";

type SynaraLogoProps = HTMLAttributes<HTMLSpanElement> & {
  "aria-label"?: string;
};

export function SynaraLogo({ className, ...props }: SynaraLogoProps) {
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
      {/* Light UI: black mark, transparent background */}
      <img src={QUACK_LOGO_LIGHT_SRC} alt="" draggable={false} className="dark:hidden" />
      {/* Dark UI: white mark, transparent background */}
      <img src={QUACK_LOGO_DARK_SRC} alt="" draggable={false} className="hidden dark:block" />
    </span>
  );
}

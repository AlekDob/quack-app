// FILE: SynaraLogo.tsx
// Purpose: Render the Quack mark PNG, swapping light/dark assets with the theme.
// Layer: Shared app branding primitive

import type { ComponentProps } from "react";
import { BrandMark } from "./BrandMark";

const QUACK_LOGO_DARK_SRC = "/synara.png";
const QUACK_LOGO_LIGHT_SRC = "/synara-light.png";

type SynaraLogoProps = Omit<ComponentProps<typeof BrandMark>, "lightSrc" | "darkSrc">;

export function SynaraLogo(props: SynaraLogoProps) {
  return <BrandMark lightSrc={QUACK_LOGO_LIGHT_SRC} darkSrc={QUACK_LOGO_DARK_SRC} {...props} />;
}

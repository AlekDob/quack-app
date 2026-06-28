interface AIIconProps {
  size?: number;
  className?: string;
  title?: string;
  /** Kept for API compatibility; the duck mark needs no extra accent. */
  sparkle?: boolean;
}

/**
 * Single source of truth for the AI brand mark used across the app
 * (activity bar, AI chat tabs, side panel header, "New AI"/"New chat"
 * buttons, the Agent toggle). It IS Jack — the Quack duck mascot — so every
 * agent/chat affordance reads as Quack at a glance.
 *
 * Renders Jack's duck avatar as a rounded mark. The image lives in
 * `public/jack.jpeg` (served at `/jack.jpeg`); swap that file to restyle
 * the mascot everywhere at once.
 */
export function AIIcon({ size = 16, className, title }: AIIconProps) {
  // Rounded square that scales with the icon — keeps a coherent "avatar"
  // shape from 12px chrome marks up to the 28px empty-state hero.
  const radius = Math.max(3, Math.round(size * 0.28));
  return (
    <img
      className={className}
      src="/jack.jpeg"
      width={size}
      height={size}
      alt=""
      draggable={false}
      aria-label={title ?? "Quack AI"}
      role="img"
      style={{
        display: "block",
        flexShrink: 0,
        objectFit: "cover",
        borderRadius: radius,
      }}
    />
  );
}

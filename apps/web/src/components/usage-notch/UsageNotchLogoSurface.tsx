// FILE: UsageNotchLogoSurface.tsx
// Purpose: Keeps the usage-notch mark at one fixed screen coordinate while the panel resizes.

export function UsageNotchLogoSurface() {
  return (
    <main className="flex size-full items-center justify-center">
      <img src="/synara.png" alt="Quack" draggable={false} className="size-5 object-contain opacity-95" />
    </main>
  );
}

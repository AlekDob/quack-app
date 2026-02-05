---
type: pattern
project: quack-app
created: 2026-01-17
migrated: true
---

# ui-directory-chooser-cyberpunk-redesign

[2026-01-17] Redesigned directory chooser button with cyberpunk aesthetic to make it impossible to miss

Design principles: pulsating neon glow, animated gradient border (orange→accent→cyan), scan line effect, floating icon animation, explosive hover state

Uses brand colors: #FF6B35 (primary), #F7931E (accent), #00D9FF (cyan)

5 concurrent animations: pulse (2.5s), border rotation (3s), scan line (2s), icon float (3s), all synchronized

Glassmorphism with backdrop-blur(16px) + saturate(180%)

Text: uppercase, 700 weight, 0.03em letter-spacing for boldness

Hover: scale(1.02) + translateY(-4px) + intensified glow (50px→100px)

Demo file: directory-chooser-demo.html in project root

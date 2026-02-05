---
type: component
project: quack-app
created: 2026-01-11
migrated: true
---

# memory-panel-animated-brain

Animated brain visualization showing entity count in Memory Panel

Location: src/components/memory/MemoryPanel.tsx lines 26-219 (AnimatedBrain component)

Features: Brain SVG that scales based on entity count (0.6x to 1.2x scale)

Visual effects: Pulsing glow rings, neural pathway animations, synaptic node flashes

Color progression: Pink (#E84A7F) -> Purple (#9333EA) -> Cyan (#06B6D4) based on entity count

Pulse speed: Faster animation when more entities (3s to 1.5s)

CSS animations: @keyframes pulse, brainPulse, neuralFlash, nodePulse

Integration: Displays entity count with 'memories stored' label below brain

Data source: Uses invoke('brain_list_entities') and listens to BRAIN_UPDATED_EVENT

[2026-01-11] AnimatedBrain component implemented with: dynamic scale (0.6x-1.2x based on entity count), color progression (pink→purple→cyan), pulsing glow rings, neural pathway animations, synaptic node flashes. Uses BRAIN_UPDATED_EVENT for real-time updates.

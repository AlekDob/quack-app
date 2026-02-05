---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# pattern_controlled_component_reset_key

React pattern for components that can be both controlled and uncontrolled

Use a resetKey prop to allow parent to trigger state reset without full control

useEffect watches resetKey changes and resets local state to defaultValue

Useful when parent needs occasional resets but not continuous control

Applied in ThinkingBlock.tsx to fix thinking mode sync bug

Pattern: const [localState, setLocalState] = useState(default); useEffect(() => { if (resetKey !== undefined) setLocalState(default); }, [resetKey, default]);

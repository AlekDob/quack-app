/** Cap auto-grow at ~8 lines (historical composer budget). */
export const COMPOSER_INPUT_MAX_HEIGHT_PX = 8 * 18 + 16;

/** Shrink/grow the composer textarea to its content (call on every value change). */
export function fitComposerInputHeight(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_INPUT_MAX_HEIGHT_PX)}px`;
}

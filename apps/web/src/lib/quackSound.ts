const QUACK_SOUND_URL = "/sounds/quack.mp3";

// Cached element so repeated completions don't re-fetch/re-decode the asset.
let quackAudio: HTMLAudioElement | null = null;

/** Plays the duck quack cue used when an agent turn completes. */
export function playQuackSound(): void {
  try {
    if (!quackAudio) {
      quackAudio = new Audio(QUACK_SOUND_URL);
    }
    // Rewind so rapid completions retrigger instead of being ignored mid-play.
    quackAudio.currentTime = 0;
    // Autoplay policy can reject before the first user gesture — ignore.
    void quackAudio.play().catch(() => {});
  } catch (error) {
    console.warn("[quack-sound] unable to play completion sound", error);
  }
}

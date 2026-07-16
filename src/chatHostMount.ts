/**
 * Chat host mount policy: live sessions stay sticky (multitask),
 * DONE/archived unload when hidden to free React trees + transcript RAM.
 */

export function shouldKeepChatHostMounted(opts: {
  visible: boolean;
  doneAt?: number;
  archivedAt?: number;
}): boolean {
  if (opts.visible) return true;
  // Live agents stay mounted while hidden so streams / multitask survive.
  if (!opts.doneAt && !opts.archivedAt) return true;
  return false;
}

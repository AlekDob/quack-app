// FILE: index.ts
// Purpose: Web paperi barrel — store, resolve, shared definitions re-exports.

export {
  BUILTIN_PAPERI,
  BUILTIN_PAPERO_IDS,
  DEFAULT_PAPERO_ID,
  JACK_PAPERO_ID,
  PAPERO_ORDER,
  buildPaperoIdentityBlock,
  buildPaperoInstructions,
  getJackDefinition,
  getPaperoDefinition,
  isPaperoId,
  listComposerPaperi,
  resolveCycledPaperoId,
  type BuiltinPaperoId,
  type PaperoDefinition,
  type PaperoId,
} from "@synara/shared/paperi";

export {
  paperoSlotProviders,
  resolvePaperoModelSelection,
  type PaperoModelSelectionMap,
  type PaperoOverrides,
  type PaperoPersistedState,
} from "./resolve";

export { usePaperoStore } from "./store";

// FILE: paperoIdentityContext.ts
// Purpose: Who a papero is right now, for the transcript turn identity.
// Layer: Chat transcript presentation
// Why: ChatView provides the Team roster resolver so an agent edited in Team updates the
//      transcript as well as the composer. A context, not a prop: the transcript pane in
//      between already carries 60 props and has a React Compiler line budget.

import { getPaperoDefinition, type PaperoDefinition, type PaperoId } from "@synara/shared/paperi";
import { createContext } from "react";

/** Default resolves the built-in definitions, which keeps standalone harnesses working. */
export const PaperoIdentityContext =
  createContext<(paperoId: PaperoId) => PaperoDefinition>(getPaperoDefinition);

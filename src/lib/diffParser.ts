import type { DiffInfo } from "../components/CodeEditorCodeMirror";

/**
 * Parsa il diff Git in formato unified e estrae i numeri di linea modificati
 * @param diffContent - Il contenuto del diff Git
 * @returns DiffInfo con array di numeri di linea per aggiunte, rimozioni e modifiche
 */
export function parseDiff(diffContent: string): DiffInfo {
  const additions: number[] = [];
  // const deletions: number[] = []; // Reserved for future use
  const modifications: number[] = [];

  const lines = diffContent.split("\n");
  let currentLine = 0;
  let inHunk = false;

  for (const line of lines) {
    // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
    if (line.startsWith("@@")) {
      const match = line.match(/@@\s*-\d+(?:,\d+)?\s*\+(\d+)/);
      if (match) {
        currentLine = parseInt(match[1], 10);
        inHunk = true;
      }
      continue;
    }

    if (!inHunk) {
      continue;
    }

    // Linea aggiunta
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions.push(currentLine);
      currentLine++;
    }
    // Linea rimossa (non incrementiamo currentLine perché la linea non esiste nel nuovo file)
    else if (line.startsWith("-") && !line.startsWith("---")) {
      // Le rimozioni non hanno un numero di linea nel nuovo file,
      // quindi le tracciamo come modifiche sulla linea corrente
      if (
        !additions.includes(currentLine) &&
        !modifications.includes(currentLine)
      ) {
        modifications.push(currentLine);
      }
    }
    // Linea invariata
    else if (line.startsWith(" ")) {
      currentLine++;
    }
  }

  // Identifica modifiche: linee che hanno sia aggiunte che rimozioni vicine
  const additionsSet = new Set(additions);
  const realModifications: number[] = [];
  const realAdditions: number[] = [];

  for (const addLine of additions) {
    // Controlla se c'è una rimozione nelle vicinanze (±2 righe)
    let hasNearbyDeletion = false;
    for (let i = -2; i <= 2; i++) {
      if (modifications.includes(addLine + i)) {
        hasNearbyDeletion = true;
        break;
      }
    }

    if (hasNearbyDeletion) {
      realModifications.push(addLine);
    } else {
      realAdditions.push(addLine);
    }
  }

  // Rimuovi le modifiche che sono state identificate come vere modifiche
  const finalModifications = modifications.filter(
    (line) => !additionsSet.has(line)
  );

  return {
    additions: realAdditions,
    deletions: [], // Git diff non mostra linee cancellate nel nuovo file
    modifications: [
      ...new Set([...realModifications, ...finalModifications]),
    ].sort((a, b) => a - b),
  };
}

/**
 * Crea un DiffInfo vuoto
 */
export function emptyDiffInfo(): DiffInfo {
  return {
    additions: [],
    deletions: [],
    modifications: [],
  };
}


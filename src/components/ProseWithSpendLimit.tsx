// Renders assistant prose, swapping spend-limit copy for SpendLimitCard.

import { balanceFences } from "../chatTextUtils";
import { splitSpendLimitText } from "../spendLimitMessage";
import { MarkdownPreview } from "./MarkdownPreview";
import { StreamingPlainText } from "./StreamingPlainText";
import { SpendLimitCard } from "./SpendLimitCard";

interface ProseWithSpendLimitProps {
  text: string;
  streaming?: boolean;
  onFileOpen?: (path: string) => void;
  onFileReveal?: (path: string) => void;
}

export function ProseWithSpendLimit({
  text,
  streaming = false,
  onFileOpen,
  onFileReveal,
}: ProseWithSpendLimitProps) {
  const hit = !streaming ? splitSpendLimitText(text) : null;
  if (!hit) {
    return streaming ? (
      <StreamingPlainText text={text} />
    ) : (
      <MarkdownPreview
        content={balanceFences(text)}
        onFileOpen={onFileOpen}
        onFileReveal={onFileReveal}
      />
    );
  }
  return (
    <>
      {hit.remainder ? (
        <MarkdownPreview
          content={balanceFences(hit.remainder)}
          onFileOpen={onFileOpen}
          onFileReveal={onFileReveal}
        />
      ) : null}
      <SpendLimitCard raw={hit.limit} />
    </>
  );
}

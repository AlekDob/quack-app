interface TurnUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

interface TurnTokenStatsProps {
  turnUsage: TurnUsage;
  turnCost?: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function TurnTokenStats({ turnUsage, turnCost }: TurnTokenStatsProps) {
  const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = turnUsage;
  const total = cache_read_input_tokens + cache_creation_input_tokens + input_tokens;
  const hitPct = total > 0 ? (cache_read_input_tokens / total) * 100 : 0;

  // Color based on cache performance
  const hitColor = hitPct >= 90 ? '#10B981' : hitPct >= 50 ? '#EAB308' : '#EF4444';

  return (
    <div className="turn-token-stats">
      <span className="turn-token-stats-hit" style={{ color: hitColor }}>
        {hitPct.toFixed(1)}% cache hit
      </span>
      <span className="turn-token-stats-sep">|</span>
      <span>Read: {formatTokens(cache_read_input_tokens)}</span>
      <span className="turn-token-stats-sep">|</span>
      <span>Create: {formatTokens(cache_creation_input_tokens)}</span>
      <span className="turn-token-stats-sep">|</span>
      <span>In: {formatTokens(input_tokens)}</span>
      <span className="turn-token-stats-sep">|</span>
      <span>Out: {formatTokens(output_tokens)}</span>
      {turnCost != null && turnCost > 0 && (
        <>
          <span className="turn-token-stats-sep">|</span>
          <span>${turnCost < 0.01 ? turnCost.toFixed(4) : turnCost.toFixed(2)}</span>
        </>
      )}
    </div>
  );
}

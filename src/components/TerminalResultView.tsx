/** Simulated terminal output for Bash tool results in the drawer. */

interface ParsedTerminal {
  stdout: string;
  exitCode: number | null;
}

function stripExitCode(text: string): { body: string; exitCode: number | null } {
  const m = text.match(
    /\n(?:Exit code|exit code|Process exited with code):\s*(\d+)\s*$/i,
  );
  if (!m || m.index === undefined) return { body: text, exitCode: null };
  return {
    body: text.slice(0, m.index).trimEnd(),
    exitCode: Number.parseInt(m[1], 10),
  };
}

function stripEchoedCommand(text: string, command: string): string {
  const cmd = command.trim();
  if (!cmd || !text.startsWith(cmd)) return text;
  return text.slice(cmd.length).trimStart();
}

function parseTerminalOutput(raw: string, command: string): ParsedTerminal {
  const { body, exitCode } = stripExitCode(raw.trimEnd());
  const stdout = stripEchoedCommand(body, command);
  return { stdout, exitCode };
}

export function TerminalResultView({
  command,
  output,
}: {
  command: string;
  output: string;
}) {
  const { stdout, exitCode } = parseTerminalOutput(output, command);
  const cmd = command.trim() || "(unknown command)";

  return (
    <div className="term-sim">
      <div className="term-sim-chrome" aria-hidden="true">
        <span className="term-sim-dots">
          <i className="term-sim-dot term-sim-dot--close" />
          <i className="term-sim-dot term-sim-dot--min" />
          <i className="term-sim-dot term-sim-dot--max" />
        </span>
        <span className="term-sim-chrome-title">bash — zsh</span>
      </div>
      <div className="term-sim-screen">
        <div className="term-sim-line">
          <span className="term-sim-prompt" aria-hidden="true">
            <span className="term-sim-prompt-user">~</span>
            <span className="term-sim-prompt-char">%</span>
          </span>
          <span className="term-sim-command">{cmd}</span>
        </div>
        {stdout ? <pre className="term-sim-output">{stdout}</pre> : null}
        {exitCode !== null ? (
          <div
            className={`term-sim-exit${
              exitCode === 0 ? " term-sim-exit--ok" : " term-sim-exit--err"
            }`}
          >
            Process exited with code {exitCode}
          </div>
        ) : null}
      </div>
    </div>
  );
}

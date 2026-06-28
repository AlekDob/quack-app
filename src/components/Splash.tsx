import { useStore } from "../store";

// Injected by vite from package.json — see vite.config.ts `define`.
declare const __APP_VERSION__: string;
const VERSION = `v${__APP_VERSION__}`;

/** One line of the fake editor. `w` is the typed width in ch (drives
 *  the CSS typewriter animation), `d` the start delay in ms. Tokens are
 *  pre-split so the splash needs no highlighter. */
interface CodeLine {
  w: number;
  d: number;
  tokens: { t: string; cls?: string }[];
}

const CODE_LINES: CodeLine[] = [
  { w: 13, d: 0, tokens: [{ t: "// welcome.ts", cls: "tok-cmt" }] },
  {
    w: 36,
    d: 220,
    tokens: [
      { t: "import", cls: "tok-kw" },
      { t: " { ai, editor } " },
      { t: "from", cls: "tok-kw" },
      { t: " " },
      { t: '"codetta"', cls: "tok-str" },
      { t: ";" },
    ],
  },
  { w: 0, d: 460, tokens: [] },
  {
    w: 43,
    d: 520,
    tokens: [
      { t: "const", cls: "tok-kw" },
      { t: " ws = " },
      { t: "await", cls: "tok-kw" },
      { t: " editor." },
      { t: "open", cls: "tok-fn" },
      { t: "(" },
      { t: '"your-project"', cls: "tok-str" },
      { t: ");" },
    ],
  },
  {
    w: 46,
    d: 900,
    tokens: [
      { t: "ai." },
      { t: "bringYourOwnModel", cls: "tok-fn" },
      { t: "(" },
      { t: '"claude"', cls: "tok-str" },
      { t: ");  " },
      { t: "// or openai · ollama", cls: "tok-cmt" },
    ],
  },
  {
    w: 17,
    d: 1340,
    tokens: [
      { t: "await", cls: "tok-kw" },
      { t: " ws." },
      { t: "ship", cls: "tok-fn" },
      { t: "();" },
    ],
  },
];

export function Splash() {
  const progress = useStore((s) => s.hydrateProgress);
  const pct = Math.max(
    0,
    Math.min(100, (progress.current / Math.max(1, progress.total)) * 100),
  );
  const phase = progress.phase || "Loading…";
  const pctRounded = Math.round(pct);
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-card">
        <img src="/quack-icon.png" className="splash-icon" alt="Quack" />
        <div className="splash-wordmark">
          <span className="splash-wordmark-version">{VERSION}</span>
        </div>
        <div className="splash-tagline">
          A lightweight desktop code editor with first-class AI
        </div>
        <div className="splash-editor" aria-hidden="true">
          <div className="splash-editor-bar">
            <span className="splash-editor-dot" />
            <span className="splash-editor-dot" />
            <span className="splash-editor-dot" />
            <span className="splash-editor-file">welcome.ts</span>
          </div>
          <div className="splash-editor-body">
            {CODE_LINES.map((line, i) => (
              <div className="splash-code-line" key={i}>
                <span className="splash-ln">{i + 1}</span>
                <span
                  className="splash-code-text"
                  style={
                    {
                      "--w": `${line.w}ch`,
                      "--d": `${line.d}ms`,
                      // ~28ms per character reads as fast, confident
                      // typing without outlasting a quick hydrate.
                      "--t": `${Math.max(1, line.w) * 28}ms`,
                      "--steps": Math.max(1, line.w),
                    } as React.CSSProperties
                  }
                >
                  {line.tokens.map((tok, j) => (
                    <span key={j} className={tok.cls}>
                      {tok.t}
                    </span>
                  ))}
                </span>
                {i === CODE_LINES.length - 1 && (
                  <span className="splash-caret" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div
          className="splash-progress-track"
          role="progressbar"
          aria-valuenow={pctRounded}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Loading: ${phase}`}
        >
          <div
            className="splash-progress-fill"
            style={{ width: `${pct}%` }}
          />
          <div className="splash-progress-shimmer" aria-hidden="true" />
        </div>
        <div className="splash-status">
          <span className="splash-phase">{phase}</span>
          <span className="splash-pct">{pctRounded}%</span>
        </div>
      </div>
      <div className="splash-credit">
        © {new Date().getFullYear()} Quack · Open source
      </div>
    </div>
  );
}

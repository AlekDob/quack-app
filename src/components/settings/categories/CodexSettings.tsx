import { useEffect, useState, useCallback } from 'react';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import { getCodexAuthStatus, type CodexAuthState } from '../../../services/codexAuthService';

const LOGIN_CMD = 'codex login';
const INSTALL_CMD = 'npm install -g @openai/codex';

export default function CodexSettings() {
  const [status, setStatus] = useState<CodexAuthState>('unknown');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await getCodexAuthStatus());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(cmd);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // noop
    }
  };

  const statusLabel =
    checking ? 'Checking' :
    status === 'ready' ? 'Signed in' :
    status === 'needs_login' ? 'Not signed in' :
    'Unknown';

  const statusTone: 'ok' | 'warn' | 'muted' =
    status === 'ready' ? 'ok' :
    status === 'needs_login' ? 'warn' :
    'muted';

  return (
    <div className="settings-category">
      <SectionHeader
        title="Codex CLI"
        description="Quack uses the local codex binary. Authentication is handled by the CLI itself — there is no API key field here."
      />

      <div className="settings-group">
        <SettingsRow
          label="Auth Status"
          description="Live probe against the local codex CLI"
          control={<StatusPill tone={statusTone} label={statusLabel} onRefresh={refresh} busy={checking} />}
        />

        <CalloutInfo>
          To sign in, open your terminal and run the command below. Codex will guide you through an OAuth flow in the browser, then store the session in <code style={codeStyle}>~/.codex/auth.json</code>. Quack picks it up automatically — just hit Refresh.
        </CalloutInfo>

        <SettingsRow
          label="Sign in"
          description="Run this in any terminal"
          control={<CommandPill cmd={LOGIN_CMD} copied={copied === LOGIN_CMD} onCopy={() => copy(LOGIN_CMD)} />}
        />
      </div>

      <SectionHeader
        title="Which account does Codex use?"
        description="Two billing paths — pick the one that matches how you logged in"
      />

      <div className="settings-group">
        <ChoiceCard
          title="ChatGPT plan (recommended)"
          body="Sign in with your ChatGPT account during codex login. Usage counts against your Plus, Pro, Team or Enterprise plan — no per-token billing."
        />
        <ChoiceCard
          title="OpenAI API key"
          body={
            <>
              Pass a platform key explicitly with <code style={codeStyle}>codex login --api-key sk-...</code>. Usage is pay-per-token on platform.openai.com and is billed separately from your ChatGPT subscription.
            </>
          }
        />
      </div>

      <SectionHeader
        title="Don't have the CLI yet?"
        description="Install it once, globally"
      />

      <div className="settings-group">
        <SettingsRow
          label="Install"
          description="Requires Node.js 18+"
          control={<CommandPill cmd={INSTALL_CMD} copied={copied === INSTALL_CMD} onCopy={() => copy(INSTALL_CMD)} />}
        />
      </div>
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 6px',
  borderRadius: 4,
  color: 'var(--text-primary)',
};

function StatusPill({ tone, label, onRefresh, busy }: { tone: 'ok' | 'warn' | 'muted'; label: string; onRefresh: () => void; busy: boolean }) {
  const dotColor =
    tone === 'ok' ? 'var(--semantic-success, #22c55e)' :
    tone === 'warn' ? 'var(--accent)' :
    'var(--text-tertiary)';
  const bg =
    tone === 'ok' ? 'rgba(34,197,94,0.10)' :
    tone === 'warn' ? 'rgba(var(--accent-rgb), 0.10)' :
    'rgba(255,255,255,0.04)';
  const border =
    tone === 'ok' ? 'rgba(34,197,94,0.25)' :
    tone === 'warn' ? 'rgba(var(--accent-rgb), 0.25)' :
    'var(--border-default)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: bg, border: `1px solid ${border}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        title="Re-check auth"
        style={{
          background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
          padding: 4, display: 'flex', alignItems: 'center',
          color: 'var(--text-secondary)', opacity: busy ? 0.4 : 0.6,
          transition: 'opacity 150ms ease, transform 250ms ease',
        }}
        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'rotate(45deg)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = busy ? '0.4' : '0.6'; e.currentTarget.style.transform = 'rotate(0)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>
    </div>
  );
}

function CommandPill({ cmd, copied, onCopy }: { cmd: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      padding: '6px 6px 6px 12px',
    }}>
      <code style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      }}>{cmd}</code>
      <button
        type="button"
        onClick={onCopy}
        style={{
          background: copied ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255,255,255,0.06)',
          border: '1px solid ' + (copied ? 'rgba(var(--accent-rgb), 0.3)' : 'var(--border-default)'),
          color: copied ? 'var(--accent)' : 'var(--text-secondary)',
          borderRadius: 6,
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function CalloutInfo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', margin: '4px 12px', borderRadius: 8,
      background: 'rgba(var(--accent-rgb), 0.06)',
      border: '1px solid rgba(var(--accent-rgb), 0.15)',
    }}>
      <span style={{
        fontSize: 11, lineHeight: '18px', flexShrink: 0,
        color: 'var(--accent)', fontWeight: 600,
      }}>i</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {children}
      </span>
    </div>
  );
}

function ChoiceCard({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div style={{
      padding: 16, margin: '4px 12px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
}

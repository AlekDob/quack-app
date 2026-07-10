import { runCommand } from "../actions";
import { Icon } from "./Icon";

interface ClaudeLoginBannerProps {
  onSignIn?: () => void;
}

export function ClaudeLoginBanner({ onSignIn }: ClaudeLoginBannerProps) {
  const signIn = () => {
    if (onSignIn) onSignIn();
    else runCommand("terminal.claude_login");
  };

  return (
    <div className="ai-cc-login-banner" role="status">
      <Icon name="alert-triangle" size={14} className="ai-cc-login-banner-icon" />
      <div className="ai-cc-login-banner-copy">
        <div className="ai-cc-login-banner-title">
          Claude Code isn&apos;t signed in
        </div>
        <div className="ai-cc-login-banner-text">
          Sign in once to use your Claude subscription or API key configured
          in the CLI.
        </div>
      </div>
      <button
        type="button"
        className="ai-cc-login-banner-btn"
        onClick={signIn}
      >
        Sign in
      </button>
    </div>
  );
}

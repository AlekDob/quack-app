import { useEffect, useState } from 'react';
import { useGitConfigStore, selectShouldShowGitOnboarding } from '../../stores/gitConfigStore';
import './GitConfigOnboarding.css';

export default function GitConfigOnboarding() {
  const {
    checkGitConfig,
    setGitConfig,
    isChecking,
  } = useGitConfigStore();

  const shouldShow = useGitConfigStore(selectShouldShowGitOnboarding);
  const [isClosing, setIsClosing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check Git config on mount
  // Safe now: won't auto-complete if manuallyReset flag is set
  useEffect(() => {
    if (shouldShow) {
      checkGitConfig();
    }
  }, [shouldShow, checkGitConfig]);

  if (!shouldShow) {
    return null;
  }

  const isFormValid = name.trim().length > 0 && email.trim().length > 0 && email.includes('@');

  const handleSubmit = async () => {
    if (!isFormValid) {
      setError('Please enter valid name and email');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await setGitConfig(name.trim(), email.trim());
      handleClose();
    } catch (err) {
      console.error('[Git Config Onboarding] Failed to set config:', err);
      setError('Failed to save Git configuration. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid && !isSubmitting) {
      handleSubmit();
    }
  };

  return (
    <div className={`git-onboarding-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="git-onboarding-dialog">
        {/* Header */}
        <div className="git-onboarding-header">
          <div className="git-onboarding-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
          <h2>Git Configuration Required</h2>
          <p>
            Before you start using Quack, we need to configure your Git identity.
            This will be used for commits and version control.
          </p>
        </div>

        {/* Form */}
        <div className="git-onboarding-form">
          {isChecking ? (
            <div className="git-onboarding-loading">
              <div className="git-onboarding-spinner" />
              <span>Checking Git configuration...</span>
            </div>
          ) : (
            <>
              <div className="git-onboarding-field">
                <label htmlFor="git-name">Full Name</label>
                <input
                  id="git-name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  autoFocus
                />
                <span className="git-onboarding-field-hint">
                  Your name will appear in Git commits
                </span>
              </div>

              <div className="git-onboarding-field">
                <label htmlFor="git-email">Email Address</label>
                <input
                  id="git-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                />
                <span className="git-onboarding-field-hint">
                  Use the email associated with your Git provider
                </span>
              </div>

              {error && (
                <div className="git-onboarding-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="git-onboarding-actions">
          <button
            className="git-onboarding-continue"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="git-onboarding-button-spinner" />
                <span>Saving...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="git-onboarding-footer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4.5v3M7 9.5h.01" strokeLinecap="round" />
          </svg>
          <span>This sets your global Git config (git config --global)</span>
        </div>
      </div>
    </div>
  );
}

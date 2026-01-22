import { useEffect, useRef } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
  version?: string;
}

const SPLASH_DURATION = 4000; // Total animation time (4 seconds)

/**
 * Splash screen for "Watch Intro" replay feature
 * Shows animated logo and "Quack" text with glow effect
 */
export default function SplashScreen({ onComplete, version }: SplashScreenProps) {
  const hasCompletedRef = useRef(false);

  // Auto-complete after animation duration
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete();
      }
    }, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const logoUrl = new URL('../../images/quackapp.png', import.meta.url).href;

  return (
    <div className="splash-screen">
      {/* Glow orb behind text */}
      <div className="splash-glow-orb" />

      {/* Main content */}
      <div className="splash-content">
        {/* Logo */}
        <img
          src={logoUrl}
          alt="Quack Logo"
          className="splash-logo"
        />

        <h1 className="splash-title">
          <span className="letter" style={{ animationDelay: '0s' }}>Q</span>
          <span className="letter" style={{ animationDelay: '0.05s' }}>u</span>
          <span className="letter" style={{ animationDelay: '0.1s' }}>a</span>
          <span className="letter" style={{ animationDelay: '0.15s' }}>c</span>
          <span className="letter" style={{ animationDelay: '0.2s' }}>k</span>
        </h1>

        <p className="splash-tagline">A Visual IDE for Claude Code Believers</p>

        {version && <span className="splash-version">{version}</span>}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
  version?: string;
}

/**
 * Minimal splash screen - animated "Quack" text with glow
 * Duration: 1 second
 */
export default function SplashScreen({ onComplete, version }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-screen">
      {/* Glow orb behind text */}
      <div className="splash-glow-orb" />

      {/* Main content */}
      <div className="splash-content">
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

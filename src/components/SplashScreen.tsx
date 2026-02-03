import { useEffect, useRef } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_DURATION = 2500; // Shorter, more elegant (2.5 seconds)

/**
 * Minimal splash screen - just "Quack" title with glow effect
 */
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete();
      }
    }, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-screen">
      {/* Glow orb behind text */}
      <div className="splash-glow-orb" />

      {/* Just the title */}
      <h1 className="splash-title">
        <span className="letter" style={{ animationDelay: '0s' }}>Q</span>
        <span className="letter" style={{ animationDelay: '0.05s' }}>u</span>
        <span className="letter" style={{ animationDelay: '0.1s' }}>a</span>
        <span className="letter" style={{ animationDelay: '0.15s' }}>c</span>
        <span className="letter" style={{ animationDelay: '0.2s' }}>k</span>
      </h1>
    </div>
  );
}

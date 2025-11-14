import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTestMode } from '../contexts/TestModeContext';

interface TitleBarProps {
  title?: string;
}

const QUOTES = [
  "🦆 A project without CLAUDE.md is like a duck without water: possible but not recommended",
  "🦆 Debugging: when the duck in your code starts quacking in production",
  "🦆 Real programmers comment their code. Wise programmers use CLAUDE.md and let the duck explain",
  "🦆 Rubber duck debugging is out. CLAUDE.md duck explaining is in",
  "🦆 Git commit -m 'fixed the thing' said the duck, lying",
  "🦆 Why do ducks make great developers? They're experts at debugging in a row",
  "🦆 Programming is 10% writing code, 90% explaining to the duck why it doesn't work",
  "🦆 A duck typed language: where errors quack at compile time",
  "🦆 CLAUDE.md: because your future self deserves better than 'TODO: fix this later'",
  "🦆 The best code is self-documenting. The wisest code has CLAUDE.md explaining why",
  "🦆 Ducks don't get imposter syndrome. They just keep swimming and coding",
  "🦆 Stack Overflow is temporary. CLAUDE.md is forever",
  "🦆 In Soviet Russia, duck debugs you",
  "🦆 Error 404: Duck not found. Please add CLAUDE.md",
  "🦆 Quack once, code twice, document with CLAUDE.md"
];

export const TitleBar: React.FC<TitleBarProps> = ({ title }) => {
  // Test mode context
  const { isTestMode, isAuthenticated, toggleAuthentication, resetTestData } = useTestMode();

  // Determine default title based on environment
  const defaultTitle = isTestMode
    ? "🦆🧪 Quack [TEST MODE]"
    : import.meta.env.DEV
      ? "🦆🧪 Quack [DEV MODE]"
      : "🦆 Quack";
  const finalTitle = title || defaultTitle;

  // Dev mode styling (also applies to test mode)
  const isDevMode = import.meta.env.DEV || isTestMode;

  const [displayText, setDisplayText] = useState(finalTitle);
  const [_isMaximized, setIsMaximized] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Typewriter effect
  useEffect(() => {
    let charIndex = 0;
    let isDeleting = false;
    let isTypingQuote = false;
    let currentQuoteIndex = 0;
    let currentText = finalTitle;

    const type = () => {
      if (!isTypingQuote) {
        // Show title for 3 seconds
        animationRef.current = setTimeout(() => {
          isTypingQuote = true;
          isDeleting = true;
          charIndex = currentText.length;
          type();
        }, 3000);
      } else {
        if (isDeleting) {
          // Delete current text
          if (charIndex > 0) {
            setDisplayText(currentText.substring(0, charIndex - 1));
            charIndex--;
            animationRef.current = setTimeout(type, 30); // Fast delete
          } else {
            // Switch to quote
            isDeleting = false;
            currentText = QUOTES[currentQuoteIndex];
            animationRef.current = setTimeout(type, 500);
          }
        } else {
          // Type new text
          if (charIndex < currentText.length) {
            setDisplayText(currentText.substring(0, charIndex + 1));
            charIndex++;
            animationRef.current = setTimeout(type, 80); // Slow typing
          } else {
            // Show quote for 5 seconds, then switch
            animationRef.current = setTimeout(() => {
              isDeleting = true;
              animationRef.current = setTimeout(() => {
                // After deleting quote, go back to title
                currentText = finalTitle;
                currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
                isTypingQuote = false;
                type();
              }, 1000);
            }, 5000);
          }
        }
      }
    };

    type();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [finalTitle]);

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    const isCurrentlyFullscreen = await window.isFullscreen();
    if (isCurrentlyFullscreen) {
      await window.setFullscreen(false);
    } else {
      await window.setFullscreen(true);
    }
    setIsMaximized(!isCurrentlyFullscreen);
  };

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  return (
    <div
      className="titlebar"
      data-tauri-drag-region
      style={{
        height: '40px',
        backgroundColor: isDevMode
          ? 'rgba(236, 127, 69, 0.85)' // #EC7F45 with transparency for glassmorphism
          : 'rgba(11, 15, 21, 0.85)', // #0B0F15 with transparency for glassmorphism
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)', // Safari support
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 16px',
        userSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        overflow: 'hidden',
        borderBottom: isDevMode
          ? '1px solid rgba(255, 255, 255, 0.3)'
          : '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: isDevMode
          ? '0 4px 16px rgba(236, 127, 69, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Typewriter text - centered */}
      <div style={{
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '0.5px',
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        minHeight: '20px'
      }}>
        {displayText}
      </div>

      {/* Test Mode Controls - posizione assoluta a destra */}
      {isTestMode && (
        <div style={{
          display: 'flex',
          gap: '8px',
          position: 'absolute',
          right: '12px',
          zIndex: 2,
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(236, 127, 69, 0.8)',
            padding: '4px 8px',
            borderRadius: '4px',
            letterSpacing: '0.5px'
          }}>
            🧪 TEST
          </span>

          <button
            onClick={toggleAuthentication}
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.95)',
              backgroundColor: isAuthenticated ? 'rgba(102, 204, 153, 0.8)' : 'rgba(255, 107, 107, 0.8)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.3px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.opacity = '1';
            }}
            title={isAuthenticated ? 'Click to simulate logout' : 'Click to simulate login'}
          >
            {isAuthenticated ? '🔓 Logout' : '🔐 Login'}
          </button>

          <button
            onClick={resetTestData}
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.95)',
              backgroundColor: 'rgba(255, 184, 77, 0.8)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.3px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.opacity = '1';
            }}
            title="Reset all test data"
          >
            🗑️ Reset
          </button>
        </div>
      )}

      {/* Pulsanti window controls - posizione assoluta a sinistra (stile macOS) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        position: 'absolute',
        left: '12px',
        zIndex: 2
      }}>
        {/* Rosso - Close (primo a sinistra) */}
        <button
          onClick={handleClose}
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#FF6B6B',
            cursor: 'pointer',
            opacity: 1,
            boxShadow: '0 2px 4px rgba(255, 107, 107, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF4444';
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FF6B6B';
            e.currentTarget.style.opacity = '1';
          }}
          title="Chiudi"
        />

        {/* Giallo - Minimize (secondo) */}
        <button
          onClick={handleMinimize}
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#FFB84D',
            cursor: 'pointer',
            opacity: 1,
            boxShadow: '0 2px 4px rgba(255, 184, 77, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FFA500';
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFB84D';
            e.currentTarget.style.opacity = '1';
          }}
          title="Minimizza"
        />

        {/* Verde - Maximize (terzo a destra) */}
        <button
          onClick={handleMaximize}
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#66CC99',
            cursor: 'pointer',
            opacity: 1,
            boxShadow: '0 2px 4px rgba(102, 204, 153, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#66CC99';
            e.currentTarget.style.opacity = '1';
          }}
          title="Massimizza"
        />
      </div>

    </div>
  );
};
import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = "🦆 Quack" }) => {
  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    await window.toggleMaximize();
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
        height: '32px',
        backgroundColor: '#EB6A3D',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        userSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {title}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleMinimize}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#FFB84D',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#8B4513',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FFA500';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFB84D';
          }}
          title="Minimizza"
        >
          ―
        </button>

        <button
          onClick={handleMaximize}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#66CC99',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#2F4F2F',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#66CC99';
          }}
          title="Massimizza"
        >
          ⬜
        </button>

        <button
          onClick={handleClose}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#FF6B6B',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#8B0000',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FF6B6B';
          }}
          title="Chiudi"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
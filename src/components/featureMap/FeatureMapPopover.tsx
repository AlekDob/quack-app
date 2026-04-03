/**
 * Feature Map — Popover detail (appears near clicked node)
 * Uses React Portal to escape any overflow:hidden containers.
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FeatureNode, FeatureLink } from './featureMapTypes';
import './FeatureMapView.css';

interface Props {
  node: FeatureNode;
  links: FeatureLink[];
  allNodes: FeatureNode[];
  screenX: number;
  screenY: number;
  onClose: () => void;
  onFileClick: (path: string) => void;
  onNodeNavigate: (nodeId: string) => void;
}

const POP_W = 340;

export default function FeatureMapPopover({
  node, links, allNodes, screenX, screenY,
  onClose, onFileClick, onNodeNavigate,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, ready: false });
  const [showFiles, setShowFiles] = useState(false);
  const [showConnected, setShowConnected] = useState(false);

  // Connected features
  const connectedIds = new Set<string>();
  for (const link of links) {
    if (link.source === node.id) connectedIds.add(link.target);
    if (link.target === node.id) connectedIds.add(link.source);
  }
  const connectedNodes = allNodes.filter(n => connectedIds.has(n.id));

  // Position: appear right next to click point, clamped to viewport
  useEffect(() => {
    if (!ref.current) return;
    const ph = ref.current.offsetHeight;
    const pad = 10;

    // Try right of click
    let x = screenX + 12;
    let y = screenY - 20;

    // Flip left if overflows right
    if (x + POP_W + pad > window.innerWidth) {
      x = screenX - POP_W - 12;
    }
    // Clamp top/bottom
    if (y + ph + pad > window.innerHeight) {
      y = window.innerHeight - ph - pad;
    }
    x = Math.max(pad, x);
    y = Math.max(pad, y);

    setPos({ x, y, ready: true });
  }, [screenX, screenY]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const popover = (
    <div
      ref={ref}
      className="fm-popover"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: POP_W,
        opacity: pos.ready ? 1 : 0,
        pointerEvents: pos.ready ? 'auto' : 'none',
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div className="fm-pop-header">
        <h3 className="fm-pop-title">{node.title}</h3>
        <button className="fm-pop-close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Purpose */}
      {node.purpose && (
        <p className="fm-pop-purpose">{node.purpose}</p>
      )}

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="fm-pop-tags">
          {node.tags.slice(0, 6).map(tag => (
            <span key={tag} className="fm-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Summary line */}
      <div className="fm-pop-summary">
        {node.files.length > 0 && <span>{node.files.length} file</span>}
        {node.stack && <span>{node.stack}</span>}
      </div>

      {/* Files (collapsible) */}
      {node.files.length > 0 && (
        <div className="fm-pop-section">
          <button className="fm-pop-toggle"
            onClick={() => setShowFiles(v => !v)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
              style={{ transform: showFiles ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s' }}>
              <path d="M3 1l5 4-5 4z" />
            </svg>
            File ({node.files.length})
          </button>
          {showFiles && (
            <ul className="fm-file-list">
              {node.files.map(file => (
                <li key={file.path} className="fm-file-item">
                  <button className="fm-file-button"
                    onClick={() => onFileClick(file.path)}
                    title={file.purpose}>
                    <span className="fm-file-type">{file.type}</span>
                    <span className="fm-file-path">
                      {file.path.split('/').pop()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Connected features (collapsible) */}
      {connectedNodes.length > 0 && (
        <div className="fm-pop-section">
          <button className="fm-pop-toggle"
            onClick={() => setShowConnected(v => !v)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
              style={{ transform: showConnected ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s' }}>
              <path d="M3 1l5 4-5 4z" />
            </svg>
            Collegate ({connectedNodes.length})
          </button>
          {showConnected && (
            <ul className="fm-connected-list">
              {connectedNodes.map(cn => (
                <li key={cn.id}>
                  <button className="fm-connected-button"
                    onClick={() => onNodeNavigate(cn.id)}>
                    {cn.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  // Portal to body — escapes overflow:hidden from any ancestor
  return createPortal(popover, document.body);
}

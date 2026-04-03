/**
 * Feature Map — Detail Panel (slide-in sidebar)
 * Shows feature details when a node is selected.
 */

import type { FeatureNode, FeatureLink } from './featureMapTypes';
import './FeatureMapView.css';

interface FeatureMapDetailPanelProps {
  node: FeatureNode;
  links: FeatureLink[];
  allNodes: FeatureNode[];
  onClose: () => void;
  onFileClick: (path: string) => void;
  onNodeNavigate: (nodeId: string) => void;
}

export default function FeatureMapDetailPanel({
  node,
  links,
  allNodes,
  onClose,
  onFileClick,
  onNodeNavigate,
}: FeatureMapDetailPanelProps) {
  // Find connected features
  const connectedNodeIds = new Set<string>();
  for (const link of links) {
    if (link.source === node.id) connectedNodeIds.add(link.target);
    if (link.target === node.id) connectedNodeIds.add(link.source);
  }
  const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id));

  return (
    <div className="fm-detail-panel">
      <div className="fm-detail-header">
        <h3 className="fm-detail-title">{node.title}</h3>
        <button className="fm-detail-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {node.purpose && (
        <p className="fm-detail-purpose">{node.purpose}</p>
      )}

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="fm-detail-tags">
          {node.tags.map(tag => (
            <span key={tag} className="fm-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Stack */}
      {node.stack && (
        <div className="fm-detail-section">
          <h4 className="fm-section-title">Stack</h4>
          <p className="fm-section-text">{node.stack}</p>
        </div>
      )}

      {/* Files */}
      {node.files.length > 0 && (
        <div className="fm-detail-section">
          <h4 className="fm-section-title">
            File ({node.files.length})
          </h4>
          <ul className="fm-file-list">
            {node.files.map(file => (
              <li key={file.path} className="fm-file-item">
                <button
                  className="fm-file-button"
                  onClick={() => onFileClick(file.path)}
                  title={file.purpose}
                >
                  <span className="fm-file-type">{file.type}</span>
                  <span className="fm-file-path">{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connected Features */}
      {connectedNodes.length > 0 && (
        <div className="fm-detail-section">
          <h4 className="fm-section-title">
            Feature collegate ({connectedNodes.length})
          </h4>
          <ul className="fm-connected-list">
            {connectedNodes.map(cn => (
              <li key={cn.id}>
                <button
                  className="fm-connected-button"
                  onClick={() => onNodeNavigate(cn.id)}
                >
                  {cn.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

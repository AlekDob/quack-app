/**
 * Whiteboard breadcrumb — navigation path for nested components.
 * Shows "Root > Parent > Current" with clickable segments.
 * Hidden when at root level.
 */

import type { ComponentNavigation } from './annotationTypes';
import './FeatureMapView.css';

interface Props {
  navigation: ComponentNavigation;
  onNavigate: (index: number) => void;
  onExitToRoot: () => void;
}

export default function WhiteboardBreadcrumb({ navigation, onNavigate, onExitToRoot }: Props) {
  if (!navigation.currentComponentId) return null;

  return (
    <div className="fm-breadcrumb">
      <button className="fm-breadcrumb-item" onClick={onExitToRoot}>
        Root
      </button>
      {navigation.breadcrumb.map((crumb, i) => {
        const isLast = i === navigation.breadcrumb.length - 1;
        return (
          <span key={crumb.id} className="fm-breadcrumb-segment">
            <span className="fm-breadcrumb-sep">&rsaquo;</span>
            {isLast ? (
              <span className="fm-breadcrumb-current">{crumb.label}</span>
            ) : (
              <button className="fm-breadcrumb-item" onClick={() => onNavigate(i)}>
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

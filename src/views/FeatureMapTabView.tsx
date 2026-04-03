import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import FeatureMapView from '../components/featureMap/FeatureMapView';

interface FeatureMapTabViewProps {
  tab: Tab;
  isActive: boolean;
  projectPath?: string;
  onOpenFileInEditor?: (filePath: string) => void;
}

/**
 * Feature Map Tab View
 * Pure SVG — no WebGL, no context preservation needed.
 * Simply mounts/unmounts based on active state.
 */
function FeatureMapTabView({
  tab,
  isActive,
  projectPath,
  onOpenFileInEditor,
}: FeatureMapTabViewProps) {
  if (tab.type !== 'feature-map') return null;
  if (!isActive) return null;

  return (
    <div
      className="feature-map-tab-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FeatureMapView projectPath={projectPath} onOpenFileInEditor={onOpenFileInEditor} />
    </div>
  );
}

export default memo(FeatureMapTabView);

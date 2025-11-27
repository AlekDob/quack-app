import DocsViewer from '../components/docs/DocsViewer';
import type { Tab } from '../components/TabBar';

interface DocsTabViewProps {
  tab: Tab;
  isActive: boolean;
}

/**
 * Wrapper component for docs tab content
 * Keeps rendering logic separate from App.tsx
 */
export default function DocsTabView({ tab, isActive }: DocsTabViewProps) {
  if (!isActive || tab.type !== 'docs') {
    return null;
  }

  return (
    <div
      className="docs-tab-view"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <DocsViewer initialPath={tab.docsPath} />
    </div>
  );
}

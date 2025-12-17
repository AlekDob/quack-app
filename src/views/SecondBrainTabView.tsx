import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import { OutlinerEditor } from '../components/second-brain/OutlinerEditor';
import './SecondBrainTabView.css';

interface SecondBrainTabViewProps {
  tab: Tab;
  isActive: boolean;
}

/**
 * Second Brain Tab View
 * A Tana-like outliner integrated with MCP Memory
 * - Every bullet is a knowledge graph node
 * - @mentions create relations
 * - #tags define supertags (entity types)
 */
function SecondBrainTabView({ tab, isActive }: SecondBrainTabViewProps) {
  if (!isActive || tab.type !== 'second-brain') {
    return null;
  }

  return (
    <div className="second-brain-tab-view">
      <OutlinerEditor initialNodeId={tab.initialNodeId} />
    </div>
  );
}

export default memo(SecondBrainTabView);

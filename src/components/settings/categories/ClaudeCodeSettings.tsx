import ClaudeAuthSettings from '../../ClaudeAuthSettings';
import AuthDebugPanel from '../../AuthDebugPanel';
import SectionHeader from '../controls/SectionHeader';

export default function ClaudeCodeSettings() {
  return (
    <div className="settings-category">
      {/* Claude Authentication */}
      <SectionHeader
        title="Claude Integration"
        description="Authenticate with Claude to enable AI-powered features"
      />
      <div className="settings-group">
        <ClaudeAuthSettings />
      </div>

      {/* Debug Panel */}
      <SectionHeader
        title="Authentication Debug"
        description="Diagnostic information for troubleshooting authentication issues"
      />
      <div className="settings-group">
        <AuthDebugPanel />
      </div>
    </div>
  );
}

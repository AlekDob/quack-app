import type { SlashCommand } from "../hooks/useSlashCommands";
import MarkdownText from "./MarkdownText";

interface CommandViewerProps {
  command: SlashCommand;
  onUseCommand?: (command: SlashCommand) => void;
}

export default function CommandViewer({
  command,
  onUseCommand,
}: CommandViewerProps) {

  const handleInsertToChat = () => {
    if (onUseCommand) {
      onUseCommand(command);
    }
  };

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '1.5rem',
      backgroundColor: 'rgba(12, 16, 24, 0.6)',
      minHeight: 0,
    }}>
      {command && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Command header */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            {/* Command Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '8px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}>
              /
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}>
                  /{command.name}
                </h3>
                {command.isBuiltin && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60A5FA',
                  }}>
                    Built-in
                  </span>
                )}
                <span style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}>
                  {command.scope}
                </span>
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.75rem',
              }}>
                {command.description}
              </div>

              {/* Parameters */}
              {command.parameters && command.parameters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {command.parameters.map((param, i) => (
                    <code key={i} style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#C084FC',
                      fontFamily: 'monospace',
                    }}>
                      {param}
                    </code>
                  ))}
                </div>
              )}

              {/* Insert to Chat button */}
              {onUseCommand && (
                <button
                  onClick={handleInsertToChat}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60A5FA',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                >
                  📋 Insert to Chat
                </button>
              )}
            </div>
          </div>

          {/* Command content (markdown) */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <MarkdownText>{command.content}</MarkdownText>
          </div>
        </div>
      )}
    </div>
  );
}

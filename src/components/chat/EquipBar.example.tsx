/**
 * EquipBar Component - Usage Example
 *
 * This example shows how to integrate EquipBar into ChatView footer.
 * Place this component in the chat footer, next to the send button.
 */

import { useState } from 'react';
import EquipBar from './EquipBar';

export function EquipBarExample() {
  const [prompt, setPrompt] = useState('');

  // Mock data - in real implementation, load from agent bundle
  const skills = ['frontend-developer', 'backend-engineer', 'test-engineer'];
  const droids = ['protocol-droid-1', 'protocol-droid-2'];
  const commands = ['commit', 'feature', 'background', 'code-review'];

  /**
   * Insert @skill:name at cursor position
   * In real implementation, this should insert into the textarea at cursor
   */
  const handleInsertSkill = (skill: string) => {
    const insertion = `@skill:${skill} `;
    setPrompt((prev) => prev + insertion);
    console.log('Insert skill:', skill);
  };

  /**
   * Insert @droid:name at cursor position
   */
  const handleInsertDroid = (droid: string) => {
    const insertion = `@droid:${droid} `;
    setPrompt((prev) => prev + insertion);
    console.log('Insert droid:', droid);
  };

  /**
   * Insert /command at cursor position
   */
  const handleInsertCommand = (command: string) => {
    const insertion = `/${command} `;
    setPrompt((prev) => prev + insertion);
    console.log('Insert command:', command);
  };

  return (
    <div style={{ padding: '20px', background: '#12141b', minHeight: '100vh' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>EquipBar Demo</h2>

      {/* Simulated chat footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'rgba(18, 20, 27, 0.97)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
      }}>
        <EquipBar
          skills={skills}
          droids={droids}
          commands={commands}
          onInsertSkill={handleInsertSkill}
          onInsertDroid={handleInsertDroid}
          onInsertCommand={handleInsertCommand}
        />

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        <button
          style={{
            padding: '10px 20px',
            background: 'var(--accent-color)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>

      {/* Preview of current prompt */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
      }}>
        <h3 style={{ color: 'var(--accent-color)', marginBottom: '8px', fontSize: '14px' }}>Current Prompt:</h3>
        <pre style={{ color: '#fff', fontSize: '13px', margin: 0 }}>
          {prompt || '(empty)'}
        </pre>
      </div>
    </div>
  );
}

/**
 * Integration Notes for ChatView:
 *
 * 1. Load equipment from agent bundle:
 *    - skills: agent.bundle.skills
 *    - droids: agent.bundle.protocol_droids
 *    - commands: loadAvailableCommands() from skillsAndDroidsLoader
 *
 * 2. Insert handlers should:
 *    - Get current cursor position in textarea
 *    - Insert @skill:name, @droid:name, or /command at cursor
 *    - Maintain cursor position after insertion
 *    - Focus back to textarea
 *
 * 3. Place in ChatView footer structure:
 *    <div className="chat-footer">
 *      <EquipBar ... />
 *      <ChatInput ... />
 *      <SendButton ... />
 *    </div>
 *
 * 4. Style considerations:
 *    - EquipBar uses flex layout, integrate with existing footer
 *    - Buttons auto-disable when arrays are empty
 *    - Popover z-index is 1000, ensure no conflicts
 */

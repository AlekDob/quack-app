# Claude Advanced Features - Conare-Inspired Enhancements 🦆

*Created by Mike - Project Manager*
*Date: 2025-10-11*
*Status: Planning Phase*
*Dependencies: Requires SDK Integration (Phase 1-3 minimum)*

---

## Executive Summary

This plan details **5 advanced Claude features** inspired by Conare.ai that significantly enhance the AI chat experience in quack-app. These features build on top of the existing SDK integration foundation and transform the chat into a professional AI development environment.

### Quick Feature Overview
1. **Model Selection UI** - Choose between Sonnet 4.5, Opus 4.1, Haiku
2. **Thinking Mode Selector** - 5 levels of reasoning depth (Auto → Ultra Think)
3. **Image Attachment Support** - Paste/attach images from clipboard or files
4. **@ File References** - Fuzzy search and attach project files to context
5. **Subagents Management** - Create/configure/deploy custom AI agents

**Total Timeline**: 4-6 phases over 5-7 days
**Priority**: Start after SDK Phase 3 completes (tool use foundation needed)

---

## 🎯 Implementation Plan: 4 Major Phases (Specification Mode)

### Phase 1: Model Selection & Thinking Mode UI (1-2 days)

**Duration**: 1-2 days
**Dependencies**: SDK Integration Phase 1-2 complete (basic chat working)
**Owner**: Julie (UI/UX) + John (Backend integration)

#### Objectives
- [ ] Create model selector dropdown with Claude models
- [ ] Pass `--model` flag to Claude Code CLI when spawning
- [ ] Implement thinking mode selector with visual indicators
- [ ] Prepend thinking keywords to prompts based on level
- [ ] Save user preferences per session and globally
- [ ] Add visual feedback for current model/thinking mode

#### Deliverables

**1. Model Selector Component: `src/components/ModelSelector.tsx`**
```typescript
interface ModelOption {
  id: 'claude-3-5-sonnet-20241022' | 'claude-3-5-opus-latest' | 'claude-3-5-haiku-20241022';
  name: string;
  description: string;
  icon: string;
  costMultiplier: number; // relative cost indicator
}

export function ModelSelector({
  value: string,
  onChange: (model: string) => void
}) {
  // Dropdown with model icons, descriptions
  // Tooltip showing capabilities/speed/cost tradeoffs
  // Persistence to localStorage + Tauri store
}
```

**2. Thinking Mode Selector: `src/components/ThinkingModeSelector.tsx`**
```typescript
type ThinkingLevel = 'auto' | 'think' | 'think-hard' | 'think-harder' | 'ultra-think';

interface ThinkingMode {
  level: ThinkingLevel;
  keyword: string; // Prepend to prompts
  description: string;
  visualBars: number; // ||| to |||||
  color: string; // Visual indicator color
}

const THINKING_MODES: ThinkingMode[] = [
  { level: 'auto', keyword: '', description: 'Let Claude decide', visualBars: 0, color: 'gray' },
  { level: 'think', keyword: 'think', description: 'Basic reasoning', visualBars: 3, color: 'blue' },
  { level: 'think-hard', keyword: 'think hard', description: 'Deep reasoning', visualBars: 4, color: 'purple' },
  { level: 'think-harder', keyword: 'think harder', description: 'Complex analysis', visualBars: 5, color: 'orange' },
  { level: 'ultra-think', keyword: 'Ultrathink.', description: 'Maximum reasoning', visualBars: 6, color: 'red' }
];
```

**3. Backend Integration: `src-tauri/src/claude_sdk/model_config.rs`**
```rust
pub struct ModelConfig {
    pub model_id: String,
    pub thinking_mode: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

pub async fn update_model_config(config: ModelConfig) -> Result<()>;
pub async fn get_model_config() -> Result<ModelConfig>;

// Modify existing send_message to respect config
pub async fn send_message_with_config(
    prompt: String,
    config: ModelConfig,
) -> Result<Response> {
    let modified_prompt = format!("{} {}", config.thinking_mode, prompt);
    // Send to SDK with selected model
}
```

**4. UI Integration in Chat Toolbar**
```typescript
// In src/components/ChatView.tsx toolbar section
<div className="chat-toolbar">
  <ModelSelector value={model} onChange={setModel} />
  <ThinkingModeSelector value={thinkingMode} onChange={setThinkingMode} />
  {/* Existing toolbar items */}
</div>
```

#### Files to Create/Modify
- **New**: `src/components/ModelSelector.tsx`
- **New**: `src/components/ThinkingModeSelector.tsx`
- **New**: `src-tauri/src/claude_sdk/model_config.rs`
- **Modify**: `src/components/ChatView.tsx` (add selectors to toolbar)
- **Modify**: `src/hooks/useClaudeChat.ts` (respect model/thinking selection)
- **Modify**: `src-tauri/src/claude_agent.rs` (apply model config)

#### Testing Strategy
- [ ] Model selection persists across sessions
- [ ] Thinking mode correctly prepends keywords
- [ ] CLI receives correct --model flag
- [ ] Visual indicators update correctly
- [ ] Preferences save to both localStorage and Tauri store
- [ ] Different models produce different response characteristics

#### Risks & Mitigation
- **Risk**: Model availability varies by API tier
  - *Mitigation*: Check user's available models, disable unavailable options
- **Risk**: Thinking keywords affect all prompts
  - *Mitigation*: Allow per-message override, clear visual indicator

#### Rollback Plan
- Default to Sonnet model if selection fails
- Remove thinking prefix if causes issues
- Feature flags: `ENABLE_MODEL_SELECTION`, `ENABLE_THINKING_MODES`

---

### Phase 2: Image Attachment Support (2 days)

**Duration**: 2 days
**Dependencies**: Phase 1 complete + SDK Phase 3 (tool use for image handling)
**Owners**: John (Backend - file handling) + Julie (Frontend - UI/UX)

#### Objectives
- [ ] Implement clipboard paste support (Cmd+V) for images
- [ ] Add attachment button (paperclip icon) for file picker
- [ ] Handle macOS temporary file paths securely
- [ ] Show image preview thumbnails in chat
- [ ] Convert images to base64 for Claude SDK
- [ ] Support multiple image formats (PNG, JPG, GIF, WebP)
- [ ] Implement drag & drop for images

#### Deliverables

**1. Image Attachment Component: `src/components/ImageAttachment.tsx`**
```typescript
interface ImageAttachment {
  id: string;
  name: string;
  path: string; // Local file path
  base64?: string; // Converted for SDK
  thumbnail?: string; // Preview thumbnail
  size: number;
  type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export function ImageAttachmentArea({
  attachments: ImageAttachment[],
  onAdd: (image: ImageAttachment) => void,
  onRemove: (id: string) => void
}) {
  // Drag & drop zone
  // Thumbnail grid display
  // Remove buttons
  // File size warnings
}
```

**2. Clipboard Handler: `src/hooks/useClipboardImage.ts`**
```typescript
export function useClipboardImage() {
  const handlePaste = async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;

    for (const item of Array.from(items || [])) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          // Handle macOS temp file paths
          const tempPath = await handleMacOSTempFile(blob);
          // Convert to base64
          const base64 = await blobToBase64(blob);
          // Create attachment
        }
      }
    }
  };

  return { handlePaste };
}
```

**3. Rust Image Handler: `src-tauri/src/claude_sdk/image_handler.rs`**
```rust
use base64::{Engine as _, engine::general_purpose};
use image::{DynamicImage, ImageFormat};

pub struct ImageHandler;

impl ImageHandler {
    pub async fn process_image(path: String) -> Result<ProcessedImage> {
        // Validate file exists and is image
        let img = image::open(&path)?;

        // Resize if needed (max 5MB for Claude)
        let resized = Self::resize_if_needed(img);

        // Convert to base64
        let base64 = Self::to_base64(resized)?;

        // Generate thumbnail
        let thumbnail = Self::generate_thumbnail(img)?;

        Ok(ProcessedImage {
            base64,
            thumbnail,
            mime_type: Self::detect_mime(&path)?,
            size: std::fs::metadata(&path)?.len(),
        })
    }

    fn resize_if_needed(img: DynamicImage) -> DynamicImage {
        const MAX_SIZE: u32 = 2048;
        // Resize logic
    }
}

// Tauri command
#[tauri::command]
pub async fn process_image_attachment(path: String) -> Result<ProcessedImage, String> {
    ImageHandler::process_image(path).await
        .map_err(|e| e.to_string())
}
```

**4. Chat Input Enhancement: `src/components/ChatInput.tsx`**
```typescript
// Add to existing ChatInput
<div className="chat-input-container">
  <ImageAttachmentArea
    attachments={images}
    onAdd={handleAddImage}
    onRemove={handleRemoveImage}
  />
  <div className="input-row">
    <button
      className="attach-button"
      onClick={openFilePicker}
      title="Attach image"
    >
      📎
    </button>
    <textarea
      {...inputProps}
      onPaste={handlePaste} // Clipboard support
    />
    <button className="send-button">Send</button>
  </div>
</div>
```

**5. SDK Integration for Vision**
```typescript
// In useClaudeChat.ts
const sendMessageWithImages = async (
  content: string,
  images: ImageAttachment[]
) => {
  const processedImages = await Promise.all(
    images.map(img => invoke('process_image_attachment', { path: img.path }))
  );

  // Claude SDK supports images in messages
  const message = {
    role: 'user',
    content: [
      { type: 'text', text: content },
      ...processedImages.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mime_type,
          data: img.base64
        }
      }))
    ]
  };

  await invoke('send_claude_message', { message });
};
```

#### Files to Create/Modify
- **New**: `src/components/ImageAttachment.tsx`
- **New**: `src/hooks/useClipboardImage.ts`
- **New**: `src-tauri/src/claude_sdk/image_handler.rs`
- **Modify**: `src/components/ChatInput.tsx` (add attachment UI)
- **Modify**: `src/hooks/useClaudeChat.ts` (support images)
- **Modify**: `src-tauri/Cargo.toml` (add `image` and `base64` crates)

#### Testing Strategy
- [ ] Paste image from clipboard works on macOS
- [ ] File picker accepts only image formats
- [ ] Large images are resized appropriately
- [ ] Thumbnails display correctly
- [ ] Multiple images can be attached
- [ ] Drag & drop works from Finder
- [ ] Base64 encoding doesn't block UI
- [ ] Claude receives and processes images correctly

#### Risks & Mitigation
- **Risk**: Large images cause memory issues
  - *Mitigation*: Resize before base64, stream processing, size limits
- **Risk**: macOS clipboard security restrictions
  - *Mitigation*: Request permissions, fallback to file picker
- **Risk**: Base64 encoding blocks UI
  - *Mitigation*: Use Web Workers, show progress indicator

#### Rollback Plan
- Disable image attachments via feature flag
- Keep text-only chat functional
- Clear error messages when images fail

---

### Phase 3: @ File References System (2 days)

**Duration**: 2 days
**Dependencies**: Phase 2 complete
**Owners**: John (Backend - file system) + Julie (Frontend - fuzzy search UI)

#### Objectives
- [ ] Trigger fuzzy file search on "@" character
- [ ] Build efficient file index for project
- [ ] Display search results with smart ranking
- [ ] Allow multiple file selection
- [ ] Show attached files as removable chips
- [ ] Include file contents in Claude context
- [ ] Support file path autocompletion

#### Deliverables

**1. File Reference Picker: `src/components/FileReferencePicker.tsx`**
```typescript
interface FileReference {
  path: string;
  relativePath: string; // Relative to project root
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  content?: string; // Lazy loaded
}

export function FileReferencePicker({
  onSelect: (files: FileReference[]) => void,
  projectRoot: string
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileReference[]>([]);

  // Fuzzy search with fuse.js
  const searchFiles = useMemo(() => {
    const fuse = new Fuse(fileIndex, {
      keys: ['name', 'relativePath'],
      threshold: 0.3,
    });
    return (q: string) => fuse.search(q);
  }, [fileIndex]);

  return (
    <div className="file-picker-dropdown">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files..."
      />
      <div className="results">
        {results.map(file => (
          <FileResultItem
            key={file.path}
            file={file}
            onSelect={() => onSelect([file])}
          />
        ))}
      </div>
    </div>
  );
}
```

**2. File Indexer (Rust): `src-tauri/src/claude_sdk/file_indexer.rs`**
```rust
use walkdir::WalkDir;
use ignore::gitignore::Gitignore;
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;

pub struct FileIndexer {
    project_root: PathBuf,
    gitignore: Gitignore,
    index: Vec<FileEntry>,
}

impl FileIndexer {
    pub fn new(project_root: PathBuf) -> Result<Self> {
        let gitignore = Gitignore::new(&project_root.join(".gitignore")).0;
        Ok(Self {
            project_root,
            gitignore,
            index: Vec::new(),
        })
    }

    pub async fn build_index(&mut self) -> Result<Vec<FileEntry>> {
        let mut entries = Vec::new();

        for entry in WalkDir::new(&self.project_root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !self.should_ignore(e))
        {
            if let Ok(e) = entry {
                if e.file_type().is_file() {
                    entries.push(FileEntry::from_path(e.path())?);
                }
            }
        }

        self.index = entries.clone();
        Ok(entries)
    }

    pub fn fuzzy_search(&self, query: &str, limit: usize) -> Vec<FileEntry> {
        let matcher = SkimMatcherV2::default();
        let mut results: Vec<_> = self.index
            .iter()
            .filter_map(|entry| {
                let score = matcher.fuzzy_match(&entry.relative_path, query)?;
                Some((score, entry.clone()))
            })
            .collect();

        results.sort_by(|a, b| b.0.cmp(&a.0));
        results.into_iter()
            .take(limit)
            .map(|(_, entry)| entry)
            .collect()
    }

    fn should_ignore(&self, entry: &DirEntry) -> bool {
        // Check gitignore
        // Ignore node_modules, .git, target, etc.
    }
}

#[tauri::command]
pub async fn search_project_files(
    query: String,
    limit: Option<usize>
) -> Result<Vec<FileEntry>, String> {
    // Use cached index for fast search
}

#[tauri::command]
pub async fn get_file_content(path: String) -> Result<String, String> {
    // Read file with size limit (e.g., 100KB)
    // Return truncated content with warning if too large
}
```

**3. @ Mention Handler: `src/hooks/useFileMentions.ts`**
```typescript
export function useFileMentions(inputRef: RefObject<HTMLTextAreaElement>) {
  const [showPicker, setShowPicker] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });
  const [currentQuery, setCurrentQuery] = useState('');

  const handleInput = (e: InputEvent) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const { value, selectionStart } = textarea;
    const textBeforeCursor = value.substring(0, selectionStart);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setCurrentQuery(query);
      setShowPicker(true);

      // Calculate dropdown position
      const position = getCaretCoordinates(textarea, selectionStart);
      setMentionPosition(position);
    } else {
      setShowPicker(false);
    }
  };

  const insertFileReference = (file: FileReference) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const { value, selectionStart } = textarea;
    const beforeMention = value.substring(0, selectionStart - currentQuery.length - 1);
    const afterCursor = value.substring(selectionStart);

    const newValue = `${beforeMention}@${file.relativePath} ${afterCursor}`;
    textarea.value = newValue;

    // Move cursor after inserted reference
    const newPosition = beforeMention.length + file.relativePath.length + 2;
    textarea.setSelectionRange(newPosition, newPosition);

    setShowPicker(false);
  };

  return {
    showPicker,
    mentionPosition,
    currentQuery,
    handleInput,
    insertFileReference
  };
}
```

**4. File Chips Display: `src/components/FileChips.tsx`**
```typescript
export function FileChips({
  files: FileReference[],
  onRemove: (path: string) => void
}) {
  return (
    <div className="file-chips">
      {files.map(file => (
        <div key={file.path} className="file-chip">
          <span className="file-icon">{getFileIcon(file.extension)}</span>
          <span className="file-name">{file.name}</span>
          <button
            className="remove-chip"
            onClick={() => onRemove(file.path)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

#### Files to Create/Modify
- **New**: `src/components/FileReferencePicker.tsx`
- **New**: `src/components/FileChips.tsx`
- **New**: `src/hooks/useFileMentions.ts`
- **New**: `src-tauri/src/claude_sdk/file_indexer.rs`
- **Modify**: `src/components/ChatInput.tsx` (integrate @ mentions)
- **Modify**: `src/hooks/useClaudeChat.ts` (include file contents)
- **Add**: `fuse.js` for fuzzy search (frontend)
- **Add**: `fuzzy-matcher`, `walkdir`, `ignore` crates (Rust)

#### Testing Strategy
- [ ] @ trigger shows picker at correct position
- [ ] Fuzzy search returns relevant results quickly
- [ ] .gitignore files are respected
- [ ] Large files are truncated with warning
- [ ] Multiple files can be attached
- [ ] File chips display correctly with icons
- [ ] File contents included in Claude context
- [ ] Performance with 10k+ files in project

#### Risks & Mitigation
- **Risk**: File indexing slow for large projects
  - *Mitigation*: Background indexing, incremental updates, caching
- **Risk**: Too many files in context exceed token limits
  - *Mitigation*: Limit file count, truncate content, show token usage
- **Risk**: Sensitive files exposed
  - *Mitigation*: Honor .gitignore, add .claudeignore support

#### Rollback Plan
- Disable @ mentions via feature flag
- Manual file path entry as fallback
- Keep chat functional without file references

---

### Phase 4: Subagents Management System (2 days)

**Duration**: 2 days
**Dependencies**: All previous phases complete
**Owners**: John (Backend - agent config) + Julie (Frontend - management UI)

#### Objectives
- [ ] Create UI for viewing/creating/editing subagents
- [ ] Design JSON schema for agent configuration
- [ ] Implement agent config validation
- [ ] Support Claude Code `--agents` flag
- [ ] Add tool permission management
- [ ] Create agent templates/presets
- [ ] Enable/disable agents per session

#### Deliverables

**1. Subagent Configuration Schema**
```typescript
interface SubagentConfig {
  id: string;
  name: string;
  description: string; // When to invoke this agent
  enabled: boolean;
  model: 'sonnet' | 'opus' | 'haiku';
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools: {
    read: boolean;
    write: boolean;
    edit: boolean;
    bash: boolean;
    grep: boolean;
    glob: boolean;
    webSearch?: boolean;
    customTools?: string[]; // Future expansion
  };
  invocationTriggers?: {
    keywords?: string[]; // Trigger on these keywords
    fileTypes?: string[]; // Trigger for these file extensions
    errorPatterns?: RegExp[]; // Trigger on error patterns
  };
}
```

**2. Subagent Manager UI: `src/components/SubagentManager.tsx`**
```typescript
export function SubagentManager() {
  const [agents, setAgents] = useState<SubagentConfig[]>([]);
  const [editingAgent, setEditingAgent] = useState<SubagentConfig | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="subagent-manager">
      <div className="agent-list">
        <h3>Available Subagents</h3>
        {agents.map(agent => (
          <SubagentCard
            key={agent.id}
            agent={agent}
            onEdit={() => setEditingAgent(agent)}
            onToggle={() => toggleAgent(agent.id)}
            onDelete={() => deleteAgent(agent.id)}
          />
        ))}
        <button
          className="create-agent-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Agent
        </button>
      </div>

      {(showCreateModal || editingAgent) && (
        <SubagentEditor
          agent={editingAgent}
          onSave={saveAgent}
          onClose={() => {
            setEditingAgent(null);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}
```

**3. Subagent Editor: `src/components/SubagentEditor.tsx`**
```typescript
export function SubagentEditor({
  agent?: SubagentConfig,
  onSave: (agent: SubagentConfig) => void,
  onClose: () => void
}) {
  const [formData, setFormData] = useState<SubagentConfig>(
    agent || createDefaultAgent()
  );

  return (
    <div className="subagent-editor-modal">
      <div className="editor-content">
        <h2>{agent ? 'Edit' : 'Create'} Subagent</h2>

        <div className="form-section">
          <label>Agent Name</label>
          <input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Python Expert"
          />
        </div>

        <div className="form-section">
          <label>Description (When to invoke)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="This agent specializes in Python development..."
          />
        </div>

        <div className="form-section">
          <label>Model</label>
          <select
            value={formData.model}
            onChange={(e) => setFormData({...formData, model: e.target.value})}
          >
            <option value="sonnet">Claude 3.5 Sonnet (Balanced)</option>
            <option value="opus">Claude 3.5 Opus (Powerful)</option>
            <option value="haiku">Claude 3.5 Haiku (Fast)</option>
          </select>
        </div>

        <div className="form-section">
          <label>System Prompt</label>
          <MonacoEditor
            language="markdown"
            value={formData.systemPrompt}
            onChange={(value) => setFormData({...formData, systemPrompt: value})}
            height="200px"
          />
        </div>

        <div className="form-section">
          <label>Allowed Tools</label>
          <div className="tools-grid">
            {Object.entries(formData.tools).map(([tool, enabled]) => (
              <label key={tool} className="tool-checkbox">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    tools: {...formData.tools, [tool]: e.target.checked}
                  })}
                />
                <span>{tool}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label>Invocation Triggers (Optional)</label>
          <TagInput
            value={formData.invocationTriggers?.keywords || []}
            onChange={(keywords) => setFormData({
              ...formData,
              invocationTriggers: {...formData.invocationTriggers, keywords}
            })}
            placeholder="Keywords that trigger this agent..."
          />
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="save-btn"
            onClick={() => onSave(formData)}
          >
            Save Agent
          </button>
        </div>
      </div>
    </div>
  );
}
```

**4. Backend Agent Manager: `src-tauri/src/claude_sdk/agent_manager.rs`**
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubagentConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub model: String,
    pub system_prompt: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub tools: ToolPermissions,
    pub invocation_triggers: Option<InvocationTriggers>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPermissions {
    pub read: bool,
    pub write: bool,
    pub edit: bool,
    pub bash: bool,
    pub grep: bool,
    pub glob: bool,
    pub web_search: Option<bool>,
}

pub struct AgentManager {
    agents: HashMap<String, SubagentConfig>,
    config_path: PathBuf,
}

impl AgentManager {
    pub async fn load_agents(&mut self) -> Result<Vec<SubagentConfig>> {
        let path = self.config_path.join("subagents.json");
        if path.exists() {
            let content = tokio::fs::read_to_string(&path).await?;
            self.agents = serde_json::from_str(&content)?;
        }
        Ok(self.agents.values().cloned().collect())
    }

    pub async fn save_agent(&mut self, agent: SubagentConfig) -> Result<()> {
        self.agents.insert(agent.id.clone(), agent);
        self.persist_to_disk().await
    }

    pub async fn generate_claude_config(&self) -> Result<String> {
        // Generate JSON config for Claude Code --agents flag
        let enabled_agents: Vec<_> = self.agents
            .values()
            .filter(|a| a.enabled)
            .collect();

        let config = json!({
            "agents": enabled_agents.iter().map(|a| {
                json!({
                    "name": a.name,
                    "description": a.description,
                    "model": a.model,
                    "systemPrompt": a.system_prompt,
                    "tools": Self::tools_to_array(&a.tools),
                })
            }).collect::<Vec<_>>()
        });

        Ok(serde_json::to_string(&config)?)
    }

    pub async fn invoke_agent(
        &self,
        agent_id: &str,
        prompt: String,
    ) -> Result<String> {
        let agent = self.agents.get(agent_id)
            .ok_or("Agent not found")?;

        // Create temporary config file
        let config_json = self.generate_claude_config().await?;
        let temp_file = std::env::temp_dir().join(format!("agent-{}.json", agent_id));
        tokio::fs::write(&temp_file, config_json).await?;

        // Spawn Claude Code with --agents flag
        let output = Command::new("claude")
            .arg("--agents")
            .arg(&temp_file)
            .arg("--model")
            .arg(&agent.model)
            .arg("-p")
            .arg(prompt)
            .output()
            .await?;

        // Clean up temp file
        tokio::fs::remove_file(&temp_file).await.ok();

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

#[tauri::command]
pub async fn create_subagent(config: SubagentConfig) -> Result<(), String>;

#[tauri::command]
pub async fn update_subagent(config: SubagentConfig) -> Result<(), String>;

#[tauri::command]
pub async fn delete_subagent(id: String) -> Result<(), String>;

#[tauri::command]
pub async fn list_subagents() -> Result<Vec<SubagentConfig>, String>;

#[tauri::command]
pub async fn invoke_subagent(
    agent_id: String,
    prompt: String
) -> Result<String, String>;
```

**5. Agent Templates/Presets**
```typescript
const AGENT_TEMPLATES: SubagentConfig[] = [
  {
    id: 'python-expert',
    name: 'Python Expert',
    description: 'Specializes in Python development, debugging, and optimization',
    model: 'sonnet',
    systemPrompt: 'You are an expert Python developer...',
    tools: { read: true, write: true, edit: true, bash: true, grep: true, glob: true },
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    description: 'Reviews code for security vulnerabilities',
    model: 'opus',
    systemPrompt: 'You are a security expert...',
    tools: { read: true, grep: true, glob: true }, // Read-only for safety
  },
  {
    id: 'test-writer',
    name: 'Test Writer',
    description: 'Writes comprehensive unit and integration tests',
    model: 'haiku',
    systemPrompt: 'You write thorough tests...',
    tools: { read: true, write: true, edit: true },
  },
];
```

#### Files to Create/Modify
- **New**: `src/components/SubagentManager.tsx`
- **New**: `src/components/SubagentEditor.tsx`
- **New**: `src/components/SubagentCard.tsx`
- **New**: `src-tauri/src/claude_sdk/agent_manager.rs`
- **New**: `src/data/agent-templates.ts`
- **Modify**: `src/App.tsx` (add subagents tab/panel)
- **Modify**: `src/hooks/useClaudeChat.ts` (support agent invocation)
- **Modify**: `src-tauri/src/lib.rs` (add agent commands)

#### Testing Strategy
- [ ] Agent creation saves correctly
- [ ] Agent editing updates configuration
- [ ] Tool permissions enforced properly
- [ ] Claude Code receives correct --agents JSON
- [ ] Agent invocation works with proper model
- [ ] Templates can be customized
- [ ] Enable/disable toggles work per session
- [ ] Config persists across app restarts

#### Risks & Mitigation
- **Risk**: Complex agent configs cause Claude errors
  - *Mitigation*: Validate JSON schema, test with Claude Code
- **Risk**: Too many agents confuse users
  - *Mitigation*: Categories, search, recommended agents
- **Risk**: Agent conflicts or overlapping triggers
  - *Mitigation*: Priority system, manual selection option

#### Rollback Plan
- Disable subagents via feature flag
- Use default Claude without agents
- Keep agent configs but don't pass to CLI

---

## 🔗 Integration Points

### With Existing SDK Integration
- **Prerequisite**: SDK Phase 1-3 must be complete
- **Shared Components**: ChatView, ChatInput, useClaudeChat
- **Backend Module**: Extends `src-tauri/src/claude_sdk/`
- **No Conflicts**: These features enhance, don't replace

### With Terminal System
- **File References**: Can reference terminal output files
- **Image Attachments**: Screenshots from terminal sessions
- **Subagents**: Can be triggered by terminal errors
- **Model Selection**: Shared across chat and terminal AI

### With File Explorer
- **@ Mentions**: Leverage existing file tree
- **Drag & Drop**: From file explorer to chat
- **Context Aware**: Current directory affects search

---

## 🧪 Comprehensive Testing Plan

### Unit Tests
```typescript
describe('Advanced Features', () => {
  describe('Model Selection', () => {
    test('persists model choice', async () => {});
    test('passes correct --model flag', async () => {});
  });

  describe('Thinking Modes', () => {
    test('prepends correct keywords', async () => {});
    test('visual indicators update', async () => {});
  });

  describe('Image Attachments', () => {
    test('clipboard paste works', async () => {});
    test('resizes large images', async () => {});
    test('generates thumbnails', async () => {});
  });

  describe('File References', () => {
    test('@ trigger shows picker', async () => {});
    test('fuzzy search returns matches', async () => {});
    test('file contents included', async () => {});
  });

  describe('Subagents', () => {
    test('agent config validates', async () => {});
    test('tools permissions enforced', async () => {});
    test('invocation triggers work', async () => {});
  });
});
```

### Integration Tests
- Full flow: Select model → Set thinking → Attach image → Reference files → Send
- Agent creation → Configuration → Invocation → Response
- Multiple features together (image + files + thinking mode)

### Performance Benchmarks
- File indexing: < 2s for 10,000 files
- Fuzzy search: < 50ms response time
- Image processing: < 500ms for 5MB image
- Agent switching: < 100ms
- Model change: Immediate effect

---

## 📊 Success Metrics

### Must Have (MVP)
- [ ] All 5 features functional
- [ ] No regression in existing features
- [ ] Performance acceptable (< 100ms UI response)
- [ ] Claude Code integration stable

### Should Have
- [ ] Smooth animations and transitions
- [ ] Keyboard shortcuts for all features
- [ ] Settings persistence across sessions
- [ ] Error recovery and retry logic

### Nice to Have
- [ ] Agent marketplace/sharing
- [ ] Custom thinking mode definitions
- [ ] Image editing before sending
- [ ] File preview in picker

---

## 🚨 Risk Matrix

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Claude API changes | High | Low | Abstraction layer, version pinning |
| Performance degradation | High | Medium | Lazy loading, virtualization, workers |
| Token limit exceeded | Medium | High | Token counting, warnings, truncation |
| File system security | High | Low | Sandboxing, permission checks |
| Clipboard access issues | Medium | Medium | Fallback to file picker |
| Agent complexity confusion | Medium | Medium | Templates, documentation, tutorials |

---

## 📅 Timeline

### Week 1 (Days 1-3)
- **Day 1**: Phase 1 - Model & Thinking Mode UI
- **Day 2**: Phase 1 completion + Phase 2 start (Images)
- **Day 3**: Phase 2 - Image Attachments

### Week 2 (Days 4-7)
- **Day 4**: Phase 2 completion + Phase 3 start
- **Day 5**: Phase 3 - @ File References
- **Day 6**: Phase 4 - Subagents Management
- **Day 7**: Phase 4 completion + Testing/Polish

### Buffer
- **+1-2 days**: For unexpected issues, additional testing, documentation

---

## 🔄 Rollback Strategy

Each feature can be independently disabled:

```typescript
// src/config/features.ts
export const FEATURE_FLAGS = {
  MODEL_SELECTION: true,
  THINKING_MODES: true,
  IMAGE_ATTACHMENTS: true,
  FILE_REFERENCES: true,
  SUBAGENTS: true,
};
```

Progressive rollback:
1. Disable problematic feature via flag
2. Keep other features functional
3. Fix issues in isolated branch
4. Re-enable when stable

---

## 🎯 Definition of Done

### Per Feature
- [ ] Core functionality works
- [ ] UI polished and responsive
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No performance regression
- [ ] Error handling complete

### Overall
- [ ] All 5 features integrated
- [ ] No conflicts with existing code
- [ ] User guide written
- [ ] Team trained on features
- [ ] Ready for production

---

## 📝 Notes & Considerations

### Technical Decisions
1. **Fuzzy Search**: Use Fuse.js (frontend) + fuzzy-matcher (Rust) for consistency
2. **Image Processing**: Resize on Rust side for performance
3. **File Indexing**: Background with incremental updates
4. **Agent Config**: JSON for Claude compatibility
5. **Thinking Keywords**: Simple prepend, not complex prompt engineering

### UI/UX Principles
1. **Progressive Disclosure**: Advanced features hidden until needed
2. **Keyboard First**: All features accessible via keyboard
3. **Visual Feedback**: Clear indicators for all states
4. **Error Prevention**: Validate before sending to Claude
5. **Consistency**: Match existing quack-app design language

### Security Considerations
1. **File Access**: Honor .gitignore and add .claudeignore
2. **Image Processing**: Sanitize EXIF data
3. **Agent Permissions**: Granular tool control
4. **Token Storage**: Never log or expose
5. **Input Validation**: Prevent injection attacks

---

*🦆 Quack quack! This comprehensive plan transforms quack-app into a professional AI development environment with Conare-inspired features. Each phase builds progressively, with clear testing strategies and rollback plans. Ready to make these features fly!*

**Created by**: Mike (Project Manager)
**Date**: 2025-10-11
**Status**: Planning Complete - Ready for Jack's Review
**Next Steps**: Review → Approval → Phase 1 Start (after SDK Phase 3)
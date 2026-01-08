use serde::{Deserialize, Serialize};

/// Core entity in the knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainEntity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub observations: Vec<BrainObservation>,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub md_file_path: Option<String>,
    // Obsidian sync metadata
    pub source_file: Option<String>,        // Path to source file
    pub date: Option<String>,               // YYYY-MM-DD format
    pub daily_link: Option<String>,         // WikiLink to diary e.g. "[[2026-01-08]]"
    pub author: Option<String>,             // Who created e.g. "agent-jack"
    pub status: Option<String>,             // active|deprecated|draft|archived
    pub confidence: Option<String>,         // high|medium|low|outdated
    pub aliases: Option<Vec<String>>,       // Alternative names
}

/// Observation attached to an entity (like MCP Memory)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainObservation {
    pub id: String,
    pub content: String,
    pub created_at: i64,
}

/// Relation between two entities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainRelation {
    pub id: String,
    pub from_entity_id: String,
    pub to_entity_id: String,
    pub relation_type: String,
    pub created_at: i64,
}

/// WikiLink extracted from markdown content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiLink {
    pub id: String,
    pub from_entity_id: String,
    pub to_entity_name: String,  // Name, not ID - may not exist yet
    pub created_at: i64,
}

/// Project registry entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: i64,
    pub last_accessed_at: i64,
}

/// Complete knowledge graph snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainGraph {
    pub entities: Vec<BrainEntity>,
    pub relations: Vec<BrainRelation>,
}

// Input types for Tauri commands

/// Input for creating a new entity
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntityInput {
    pub name: String,
    pub entity_type: String,
    pub observations: Vec<String>,
    pub project_id: Option<String>,
}

/// Input for updating an entity
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntityInput {
    pub name: Option<String>,
    pub entity_type: Option<String>,
}

/// Filters for listing entities
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityFilters {
    pub project_id: Option<String>,
    pub entity_type: Option<String>,
    pub search_query: Option<String>,
}

/// Search result with relevance score
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub entity: BrainEntity,
    pub score: f64,
}

/// Semantic search result with cosine similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticSearchResult {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub score: f32,
}

/// Hybrid search result combining FTS and semantic search
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HybridSearchResult {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub score: f32,
}

// ============================================
// Obsidian Sync Types
// ============================================

/// Brain settings for Obsidian sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainSettings {
    pub vault_path: String,
    pub sync_enabled: bool,
    pub sync_structure: String,
    pub auto_sync_to_vault: bool,
    pub auto_sync_from_vault: bool,
    pub conflict_policy: String,
    pub auto_embed: bool,
    pub markdown_editor: String,
}

impl Default for BrainSettings {
    fn default() -> Self {
        Self {
            vault_path: String::new(),
            sync_enabled: false,
            sync_structure: "subfolder".to_string(),
            auto_sync_to_vault: true,
            auto_sync_from_vault: true,
            conflict_policy: "ask".to_string(),
            auto_embed: true,
            markdown_editor: "obsidian".to_string(),
        }
    }
}

/// Sync status for an entity
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub entity_id: String,
    pub has_conflict: bool,
    pub brain_updated_at: i64,
    pub vault_updated_at: Option<i64>,
    pub sync_hash: Option<String>,
}

/// Sync conflict details between Brain and Obsidian vault
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflict {
    pub entity_id: String,
    pub entity_name: String,
    pub brain_content: String,
    pub vault_content: String,
    pub brain_updated_at: i64,
    pub vault_updated_at: i64,
}

/// Extended entity info with sync metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainEntityWithSync {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub observations: Vec<BrainObservation>,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub md_file_path: Option<String>,
    // Sync fields
    pub sync_hash: Option<String>,
    pub last_synced_at: Option<i64>,
    pub sync_source: Option<String>,
    pub vault_relative_path: Option<String>,
    // Obsidian sync metadata
    pub source_file: Option<String>,
    pub date: Option<String>,
    pub daily_link: Option<String>,
    pub author: Option<String>,
    pub status: Option<String>,
    pub confidence: Option<String>,
    pub aliases: Option<Vec<String>>,
}

// ============================================
// Helper Functions
// ============================================

/// Map entity type tag to Obsidian folder name
pub fn get_folder_for_tag(tag: &str) -> &'static str {
    match tag {
        "component" => "components",
        "function" => "functions",
        "api" => "api",
        "pattern" => "patterns",
        "bug" | "bug_fix" => "bugs",
        "decision" => "decisions",
        "task" => "tasks",
        "config" => "config",
        "idea" => "ideas",
        "todo" => "todos",
        "human" => "humans",
        "note" => "notes",
        "diary" => "diary",
        _ => "notes",  // default fallback
    }
}

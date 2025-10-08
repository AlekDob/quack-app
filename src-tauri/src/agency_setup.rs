use std::{collections::HashMap, fs, path::PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// Setup wizard data from frontend
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupWizardData {
    pub user_name: String,
    pub user_language: String,
    pub description: String,
    pub tech_stack: String,
    pub features: Vec<String>,
    pub init_git: bool,
    pub create_agents: bool,
}

/// Setup result returned to frontend
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupResult {
    pub success: bool,
    pub message: String,
    pub agents_created: usize,
    pub files_created: Vec<String>,
}

/// Embedded template files
struct Templates {
    // Main files
    claude_md: &'static str,
    agents_md: &'static str,

    // Project plan
    plan_md: &'static str,

    // Docs
    prd_template: &'static str,
    techstack: &'static str,

    // Diary
    diary_readme: &'static str,
    daily_log_template: &'static str,

    // Commands
    commit_cmd: &'static str,
    diary_cmd: &'static str,

    // Agents
    mike: &'static str,
    scott: &'static str,
    julie: &'static str,
    john: &'static str,
    carmelo: &'static str,
    giuseppe: &'static str,
    roberta: &'static str,
}

impl Templates {
    /// Load all embedded templates
    fn load() -> Self {
        Self {
            claude_md: include_str!("../templates/CLAUDE.md"),
            agents_md: include_str!("../templates/agents.md"),
            plan_md: include_str!("../templates/project-plan/plan.md"),
            prd_template: include_str!("../templates/docs/prd-template.md"),
            techstack: include_str!("../templates/docs/techstack.md"),
            diary_readme: include_str!("../templates/diary/README.md"),
            daily_log_template: include_str!("../templates/diary/daily-log-template.md"),
            commit_cmd: include_str!("../templates/commands/commit.md"),
            diary_cmd: include_str!("../templates/commands/diary.md"),
            mike: include_str!("../templates/agents/mike-project-manager.md"),
            scott: include_str!("../templates/agents/scott-hr-manager.md"),
            julie: include_str!("../templates/agents/julie-designer.md"),
            john: include_str!("../templates/agents/john-backend.md"),
            carmelo: include_str!("../templates/agents/carmelo-prompt-engineer.md"),
            giuseppe: include_str!("../templates/agents/giuseppe-git-manager.md"),
            roberta: include_str!("../templates/agents/roberta-setup-expert.md"),
        }
    }
}

/// Replace placeholders in template content
fn replace_placeholders(template: &str, data: &SetupWizardData, project_name: &str) -> String {
    let mut replacements = HashMap::new();

    // Basic placeholders
    replacements.insert("{{USER_NAME}}", data.user_name.as_str());
    replacements.insert("{{USER_LANGUAGE}}", get_language_name(&data.user_language));
    replacements.insert("{{PROJECT_NAME}}", project_name);
    replacements.insert("{{PROJECT_DESCRIPTION}}", data.description.as_str());
    replacements.insert("{{TECH_STACK}}", data.tech_stack.as_str());
    replacements.insert("{{PROJECT_TYPE}}", "existing");

    // Features as comma-separated string
    let features_str = data.features.join(", ");
    replacements.insert("{{FEATURES}}", &features_str);

    // Current date in YYYY-MM-DD format
    let current_date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let current_date_str = Box::leak(current_date.into_boxed_str());
    replacements.insert("{{CURRENT_DATE}}", current_date_str);

    // Jack personality (simplified)
    replacements.insert("{{JACK_PERSONALITY.description}}", "Full sarcasm mode activated");
    replacements.insert("{{JACK_PERSONALITY.style}}", "maximum wit and creative commentary");

    // Apply all replacements
    let mut result = template.to_string();
    for (placeholder, value) in replacements {
        result = result.replace(placeholder, value);
    }

    // Remove Handlebars conditionals (simplified - just remove the syntax)
    result = remove_handlebars_syntax(&result);

    result
}

/// Convert language code to full language name
fn get_language_name(code: &str) -> &'static str {
    match code {
        "english" => "English",
        "italian" => "Italian",
        "spanish" => "Spanish",
        "french" => "French",
        "german" => "German",
        "portuguese" => "Portuguese",
        "dutch" => "Dutch",
        "japanese" => "Japanese",
        "korean" => "Korean",
        "chinese" => "Chinese",
        _ => "English",
    }
}

/// Remove Handlebars syntax (simplified approach)
fn remove_handlebars_syntax(content: &str) -> String {
    let mut result = content.to_string();

    // Remove {{#if ...}} blocks (keep content inside)
    result = regex::Regex::new(r"(?s)\{\{#if [^}]+\}\}(.*?)\{\{/if\}\}")
        .unwrap()
        .replace_all(&result, "$1")
        .to_string();

    // Remove {{#each ...}} blocks (keep content inside)
    result = regex::Regex::new(r"(?s)\{\{#each [^}]+\}\}(.*?)\{\{/each\}\}")
        .unwrap()
        .replace_all(&result, "$1")
        .to_string();

    // Remove {{else}} tags
    result = result.replace("{{else}}", "");

    // Remove remaining {{this}} references
    result = result.replace("{{this}}", "");

    result
}

/// Create directory structure for Quack Agency
fn create_directory_structure(base_path: &PathBuf) -> Result<()> {
    let directories = vec![
        ".claude/agents",
        ".claude/commands",
        "project-plan",
        "docs",
        "diary",
        "scripts",
    ];

    for dir in directories {
        let dir_path = base_path.join(dir);
        fs::create_dir_all(&dir_path)
            .with_context(|| format!("Failed to create directory: {:?}", dir_path))?;
    }

    Ok(())
}

/// Setup complete Quack Agency structure
#[tauri::command]
pub fn setup_quack_agency_full(
    data: SetupWizardData,
    working_dir: Option<String>,
) -> Result<SetupResult, String> {
    setup_quack_agency_impl(data, working_dir).map_err(|err| err.to_string())
}

fn setup_quack_agency_impl(
    data: SetupWizardData,
    working_dir: Option<String>,
) -> Result<SetupResult> {
    // Determine base path
    let base_path = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    // Get project name from directory
    let project_name = base_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("quack-project")
        .to_string();

    log::info!("Setting up Quack Agency in: {:?}", base_path);
    log::info!("Project name: {}", project_name);

    // Load templates
    let templates = Templates::load();

    // Create directory structure
    create_directory_structure(&base_path)?;

    let mut files_created = Vec::new();

    // 1. Create/Update CLAUDE.md
    let claude_path = base_path.join("CLAUDE.md");
    let claude_content = replace_placeholders(templates.claude_md, &data, &project_name);

    // Check if CLAUDE.md already exists
    if claude_path.exists() {
        let existing_content = fs::read_to_string(&claude_path)?;
        let separator = "\n\n<!-- ========================================= -->\n<!-- EXISTING CLAUDE.MD CONTENT PRESERVED BELOW -->\n<!-- ========================================= -->\n\n";
        let combined_content = claude_content + separator + &existing_content;
        fs::write(&claude_path, combined_content)?;
        files_created.push("CLAUDE.md (updated with Quack Agency)".to_string());
    } else {
        fs::write(&claude_path, claude_content)?;
        files_created.push("CLAUDE.md".to_string());
    }

    // 2. Create agents.md
    let agents_content = replace_placeholders(templates.agents_md, &data, &project_name);
    fs::write(base_path.join("agents.md"), agents_content)?;
    files_created.push("agents.md".to_string());

    // 3. Create project-plan/plan.md
    let plan_content = replace_placeholders(templates.plan_md, &data, &project_name);
    fs::write(base_path.join("project-plan/plan.md"), plan_content)?;
    files_created.push("project-plan/plan.md".to_string());

    // 4. Create docs files
    let prd_content = replace_placeholders(templates.prd_template, &data, &project_name);
    fs::write(base_path.join("docs/project-requirements.md"), prd_content)?;
    files_created.push("docs/project-requirements.md".to_string());

    let techstack_content = replace_placeholders(templates.techstack, &data, &project_name);
    fs::write(base_path.join("docs/techstack.md"), techstack_content)?;
    files_created.push("docs/techstack.md".to_string());

    // 5. Create diary files
    let diary_readme_content = replace_placeholders(templates.diary_readme, &data, &project_name);
    fs::write(base_path.join("diary/README.md"), diary_readme_content)?;
    files_created.push("diary/README.md".to_string());

    // Create initial daily log with current date
    let daily_log_content = replace_placeholders(templates.daily_log_template, &data, &project_name);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    fs::write(base_path.join(format!("diary/{}.md", today)), daily_log_content)?;
    files_created.push(format!("diary/{}.md", today));

    // 6. Create command files
    let commit_content = replace_placeholders(templates.commit_cmd, &data, &project_name);
    fs::write(base_path.join(".claude/commands/commit.md"), commit_content)?;
    files_created.push(".claude/commands/commit.md".to_string());

    let diary_cmd_content = replace_placeholders(templates.diary_cmd, &data, &project_name);
    fs::write(base_path.join(".claude/commands/diary.md"), diary_cmd_content)?;
    files_created.push(".claude/commands/diary.md".to_string());

    // 7. Create agent files (if requested)
    let mut agents_created = 0;
    if data.create_agents {
        let agents = vec![
            ("mike-project-manager.md", templates.mike),
            ("scott-hr-manager.md", templates.scott),
            ("julie-designer.md", templates.julie),
            ("john-backend.md", templates.john),
            ("carmelo-prompt-engineer.md", templates.carmelo),
            ("giuseppe-git-manager.md", templates.giuseppe),
            ("roberta-setup-expert.md", templates.roberta),
        ];

        for (filename, template_content) in agents {
            let agent_content = replace_placeholders(template_content, &data, &project_name);
            let agent_path = base_path.join(format!(".claude/agents/{}", filename));
            fs::write(&agent_path, agent_content)?;
            files_created.push(format!(".claude/agents/{}", filename));
            agents_created += 1;
        }
    }

    log::info!("Quack Agency setup completed successfully!");
    log::info!("Created {} files, {} agents", files_created.len(), agents_created);

    Ok(SetupResult {
        success: true,
        message: format!("🦆 Quack Agency setup completed! Created {} files and {} agents.", files_created.len(), agents_created),
        agents_created,
        files_created,
    })
}

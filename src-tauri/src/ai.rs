use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIRequest {
    pub intent: String,
    pub context: TerminalContext,
    pub request_type: String, // "command" | "error"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TerminalContext {
    pub os: String,              // "macos", "linux", "windows"
    pub shell: String,           // "zsh", "bash", "fish"
    pub cwd: String,             // current working directory
    pub recent_commands: Vec<String>, // last 5 commands
    pub error_output: Option<String>, // if type = "error"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AISuggestion {
    pub command: String,
    pub explanation: String,
    pub confidence: f32,
    pub alternative: Option<String>,
}

// Prompt Engineering structures
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIQuestion {
    pub question: String,
    pub question_number: u32,
    pub total_questions: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIAnswer {
    pub question_number: u32,
    pub answer: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIPromptImprovement {
    pub original_prompt: String,
    pub improved_prompt: String,
    pub improvements: Vec<String>,
    pub confidence: f32,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AIPromptEngineerResponse {
    #[serde(rename = "questions")]
    Questions { questions: Vec<AIQuestion> },
    #[serde(rename = "improvement")]
    Improvement { improvement: AIPromptImprovement },
}

#[derive(Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: OpenAIUsage,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Deserialize)]
struct OpenAIUsage {
    total_tokens: u32,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TokenStats {
    pub total_tokens_used: u32,
    pub estimated_cost: f32,
    pub request_count: u32,
}

// ============================================================================
// Global State
// ============================================================================

static RATE_LIMITER: Lazy<Mutex<RateLimiter>> = Lazy::new(|| {
    Mutex::new(RateLimiter {
        requests: Vec::new(),
        max_per_minute: 10,
    })
});

static SUGGESTION_CACHE: Lazy<Mutex<HashMap<String, (AISuggestion, Instant)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static TOKEN_STATS: Lazy<Mutex<TokenStats>> = Lazy::new(|| {
    Mutex::new(TokenStats {
        total_tokens_used: 0,
        estimated_cost: 0.0,
        request_count: 0,
    })
});

// ============================================================================
// Rate Limiting
// ============================================================================

struct RateLimiter {
    requests: Vec<Instant>,
    max_per_minute: usize,
}

impl RateLimiter {
    fn can_proceed(&mut self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);

        // Remove old requests
        self.requests.retain(|&time| time > one_minute_ago);

        if self.requests.len() < self.max_per_minute {
            self.requests.push(now);
            true
        } else {
            false
        }
    }
}

// ============================================================================
// Caching
// ============================================================================

fn get_cached_suggestion(intent: &str) -> Option<AISuggestion> {
    let cache = SUGGESTION_CACHE.lock().unwrap();
    if let Some((suggestion, timestamp)) = cache.get(intent) {
        // Cache valid for 1 hour
        if timestamp.elapsed() < Duration::from_secs(3600) {
            return Some(suggestion.clone());
        }
    }
    None
}

fn store_in_cache(intent: String, suggestion: AISuggestion) {
    let mut cache = SUGGESTION_CACHE.lock().unwrap();
    cache.insert(intent, (suggestion, Instant::now()));
}

// ============================================================================
// Token Tracking
// ============================================================================

fn track_token_usage(tokens: u32, model: &str) {
    let mut stats = TOKEN_STATS.lock().unwrap();
    stats.total_tokens_used += tokens;
    stats.request_count += 1;

    // Cost calculation (approximate, based on OpenAI pricing)
    let cost_per_1m_tokens = match model {
        "gpt-4o-mini" => 0.15,
        "gpt-4o" => 2.50,
        "gpt-3.5-turbo" => 0.50,
        _ => 0.15,
    };

    let cost = (tokens as f32 / 1_000_000.0) * cost_per_1m_tokens;
    stats.estimated_cost += cost;
}

// ============================================================================
// API Key Storage (using preferences module)
// ============================================================================

#[tauri::command]
pub async fn save_api_key(app: AppHandle, key: String) -> Result<(), String> {
    // Base64 encode for basic obfuscation
    let encoded = STANDARD.encode(key.as_bytes());

    // Use preferences module to store
    crate::preferences::set_ai_api_key(app, encoded).await
}

async fn get_stored_api_key(app: &AppHandle) -> Result<String> {
    let encoded = crate::preferences::get_ai_api_key(app.clone())
        .await
        .map_err(|e| anyhow!("Failed to get API key from preferences: {}", e))?
        .ok_or_else(|| anyhow!("API key not configured"))?;

    let decoded_bytes = STANDARD
        .decode(encoded)
        .map_err(|e| anyhow!("Failed to decode API key: {}", e))?;

    let decoded = String::from_utf8(decoded_bytes)
        .map_err(|e| anyhow!("Invalid UTF-8 in API key: {}", e))?;

    Ok(decoded)
}

#[tauri::command]
pub async fn test_api_connection(app: AppHandle) -> Result<bool, String> {
    let api_key = get_stored_api_key(&app).await.map_err(|e| e.to_string())?;

    let client = Client::new();
    let response = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

#[tauri::command]
pub fn get_token_usage_stats() -> Result<TokenStats, String> {
    let stats = TOKEN_STATS.lock().unwrap();
    Ok(stats.clone())
}

// ============================================================================
// Prompt Templates
// ============================================================================

fn build_system_prompt(context: &TerminalContext) -> String {
    format!(
        r#"You are an expert terminal command assistant for {os}.
Shell: {shell}
Directory: {cwd}

Your task is to suggest precise terminal commands based on the user's intent.

Respond ONLY in JSON format:
{{
  "command": "exact command to execute",
  "explanation": "brief explanation (max 100 characters)",
  "confidence": 0.95,
  "alternative": "alternative command (optional)"
}}

RULES:
1. The command must be executable in {shell} on {os}
2. If intent is unclear, use confidence < 0.7
3. Suggest alternatives when possible
4. Consider current directory context: {cwd}
5. Keep recent commands in mind for consistency

EXAMPLES:
- Intent: "install prettier" → {{"command": "npm install -D prettier", "explanation": "Install Prettier as dev dependency", "confidence": 0.98}}
- Intent: "list files" → {{"command": "ls -la", "explanation": "Show all files including hidden", "confidence": 1.0, "alternative": "ls -lh"}}
- Intent: "run dev server" → {{"command": "npm run dev", "explanation": "Start development server", "confidence": 0.90}}

RECENT COMMANDS CONTEXT:
{recent_commands}

Analyze recent commands to understand the user's workflow and suggest coherent commands."#,
        os = context.os,
        shell = context.shell,
        cwd = context.cwd,
        recent_commands = context.recent_commands.join("\n")
    )
}

fn build_error_analysis_prompt(error: &str, context: &TerminalContext) -> String {
    format!(
        r#"You are an expert in terminal debugging and system administration for {os}.

Your task is to analyze terminal errors and suggest practical solutions.

Respond ONLY in JSON format:
{{
  "command": "command to fix (if applicable, otherwise null)",
  "explanation": "clear explanation of problem and solution (max 200 characters)",
  "confidence": 0.85
}}

SYSTEM CONTEXT:
OS: {os}
Shell: {shell}
Directory: {cwd}
Recent commands: {recent_commands}

ERROR TO ANALYZE:
```
{error_output}
```

RULES:
1. Identify error type (permission, missing module, syntax, network, etc.)
2. Suggest the simplest command to fix
3. If no command can fix it, provide manual steps and set "command": null
4. Use confidence < 0.6 if error is ambiguous
5. Consider recent command context to understand what user was trying to do

EXAMPLES:
- Error: "bash: npm: command not found" → {{"command": "brew install node", "explanation": "npm not installed. Install Node.js which includes npm", "confidence": 0.95}}
- Error: "Error: Cannot find module 'vite'" → {{"command": "npm install vite", "explanation": "vite module missing. Install it with npm", "confidence": 0.98}}
- Error: "Permission denied: ./script.sh" → {{"command": "chmod +x script.sh", "explanation": "File not executable. Add execution permissions", "confidence": 0.99}}"#,
        os = context.os,
        shell = context.shell,
        cwd = context.cwd,
        recent_commands = context.recent_commands.join(" → "),
        error_output = error
    )
}

// Helper function to clean JSON response from markdown code fences
fn clean_json_response(response: &str) -> String {
    let trimmed = response.trim();

    // Remove markdown code fences if present
    if trimmed.starts_with("```json") {
        trimmed
            .strip_prefix("```json")
            .unwrap_or(trimmed)
            .strip_suffix("```")
            .unwrap_or(trimmed)
            .trim()
            .to_string()
    } else if trimmed.starts_with("```") {
        trimmed
            .strip_prefix("```")
            .unwrap_or(trimmed)
            .strip_suffix("```")
            .unwrap_or(trimmed)
            .trim()
            .to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_prompt_engineering_questions_prompt(original_prompt: &str) -> String {
    format!(
        r#"You are an expert prompt engineer specializing in improving AI prompts.

USER'S ORIGINAL PROMPT:
```
{original_prompt}
```

LANGUAGE RULE: Respond in English by default. If you can clearly detect the user's prompt is in another language (Italian, Spanish, French, etc.), you may respond in that language. When in doubt, use English.

Your task is to ask 2-3 clarifying questions to help improve the user's prompt.

Respond ONLY with pure JSON (NO markdown code fences, NO ```json wrapper):
{{
  "questions": [
    {{
      "question": "First clarifying question",
      "questionNumber": 1,
      "totalQuestions": 3
    }},
    {{
      "question": "Second clarifying question",
      "questionNumber": 2,
      "totalQuestions": 3
    }},
    {{
      "question": "Third clarifying question",
      "questionNumber": 3,
      "totalQuestions": 3
    }}
  ]
}}

RULES FOR QUESTIONS:
1. Write questions in English by default; match user's language if clearly detectable
2. Ask specific, actionable questions that will help clarify the user's intent
3. Focus on missing details, context, constraints, or desired outcomes
4. Keep questions short and focused (max 100 characters each)
5. Ask 2-3 questions maximum
6. Make questions conversational and friendly

EXAMPLE INPUT:
"Build a web app"

EXAMPLE OUTPUT:
{{
  "questions": [
    {{
      "question": "What specific features should this web app have?",
      "questionNumber": 1,
      "totalQuestions": 3
    }},
    {{
      "question": "What tech stack do you prefer (React, Vue, vanilla JS)?",
      "questionNumber": 2,
      "totalQuestions": 3
    }},
    {{
      "question": "Do you need user authentication or a database?",
      "questionNumber": 3,
      "totalQuestions": 3
    }}
  ]
}}

Now analyze the user's prompt and generate thoughtful clarifying questions. Use English by default, or match the user's language if clearly detectable.
Return ONLY pure JSON without markdown code fences."#,
        original_prompt = original_prompt
    )
}

fn build_prompt_improvement_prompt(original_prompt: &str, answers: &[AIAnswer]) -> String {
    let answers_text = answers
        .iter()
        .map(|a| format!("Q{}: {}", a.question_number, a.answer))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"You are an expert prompt engineer specializing in improving AI prompts.

ORIGINAL PROMPT:
```
{original_prompt}
```

USER'S ANSWERS TO CLARIFYING QUESTIONS:
{answers}

LANGUAGE RULE: Write the improved prompt in English by default. If you can clearly detect the original prompt is in another language (Italian, Spanish, French, etc.), you may write the improved prompt in that language. When in doubt, use English.

Your task is to improve the user's original prompt based on their answers to clarifying questions.

Respond ONLY with pure JSON (NO markdown code fences, NO ```json wrapper):
{{
  "originalPrompt": "copy of original prompt",
  "improvedPrompt": "significantly improved version of the prompt",
  "improvements": [
    "Added specific detail about X",
    "Clarified context regarding Y",
    "Defined constraints for Z"
  ],
  "confidence": 0.95
}}

RULES FOR IMPROVEMENT:
1. Write improved prompt in English by default; match original language if clearly detectable
2. Make the prompt significantly more detailed and specific
3. Incorporate ALL information from user answers
4. Structure the improved prompt clearly with sections if needed
5. Include context, constraints, expected outcomes, and technical details
6. Make it actionable for any AI system
7. Keep it concise but comprehensive (aim for 3-5x more detail than original)
8. List 3-5 specific improvements made
9. Set confidence based on how much clarity was gained (0.7-1.0)

EXAMPLE:

ORIGINAL: "Build a web app"
ANSWERS:
Q1: E-commerce store with product listings and checkout
Q2: React with TypeScript, Tailwind CSS
Q3: Yes, need Firebase auth and product database

IMPROVED PROMPT:
"Build a modern e-commerce web application with the following specifications:

TECH STACK:
- Frontend: React 18 + TypeScript
- Styling: Tailwind CSS
- Authentication: Firebase Auth
- Database: Firebase Firestore for products and orders

CORE FEATURES:
1. Product catalog with search and filtering
2. Shopping cart with quantity management
3. User authentication (sign up, login, logout)
4. Secure checkout flow
5. Order history for authenticated users

REQUIREMENTS:
- Mobile-responsive design
- Fast page load times
- Secure payment processing
- Clean, modern UI following e-commerce best practices

Please structure the project with clear component hierarchy and follow React best practices."

Now improve the user's prompt using their answers. Use English by default, or match the original language if clearly detectable.
Return ONLY pure JSON without markdown code fences."#,
        original_prompt = original_prompt,
        answers = answers_text
    )
}

// ============================================================================
// OpenAI Client
// ============================================================================

async fn call_openai(
    app: &AppHandle,
    prompt: String,
    context: &TerminalContext,
    model: &str,
    is_error_analysis: bool,
) -> Result<String> {
    let api_key = get_stored_api_key(app).await?;

    let client = Client::new();
    let system_prompt = if is_error_analysis {
        build_error_analysis_prompt(&prompt, context)
    } else {
        build_system_prompt(context)
    };

    let body = OpenAIRequest {
        model: model.to_string(),
        messages: vec![
            OpenAIMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            OpenAIMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        temperature: if is_error_analysis { 0.4 } else { 0.3 },
        max_tokens: if is_error_analysis { 700 } else { 500 },
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| anyhow!("OpenAI API request failed: {}", e))?
        .json::<OpenAIResponse>()
        .await
        .map_err(|e| anyhow!("Failed to parse OpenAI response: {}", e))?;

    // Track token usage
    track_token_usage(response.usage.total_tokens, model);

    Ok(response.choices[0].message.content.clone())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn get_ai_suggestion(
    app: AppHandle,
    request: AIRequest,
) -> Result<AISuggestion, String> {
    // Check rate limit
    {
        let mut limiter = RATE_LIMITER.lock().unwrap();
        if !limiter.can_proceed() {
            return Err("Rate limit exceeded. Please wait a moment.".to_string());
        }
    }

    // Check cache
    if let Some(cached) = get_cached_suggestion(&request.intent) {
        return Ok(cached);
    }

    // Determine model based on request type
    let model = if request.request_type == "error" {
        "gpt-4o-mini" // Use mini even for errors for cost efficiency
    } else {
        "gpt-4o-mini"
    };

    // Call OpenAI
    let ai_response = call_openai(
        &app,
        request.intent.clone(),
        &request.context,
        model,
        request.request_type == "error",
    )
    .await
    .map_err(|e| e.to_string())?;

    // Parse JSON response
    let suggestion: AISuggestion = serde_json::from_str(&ai_response).map_err(|e| {
        format!(
            "Failed to parse AI response as JSON: {}. Response: {}",
            e, ai_response
        )
    })?;

    // Validate confidence
    if suggestion.confidence < 0.5 {
        return Err("AI confidence too low for this suggestion".to_string());
    }

    // Store in cache
    store_in_cache(request.intent, suggestion.clone());

    Ok(suggestion)
}

#[tauri::command]
pub async fn analyze_error(
    app: AppHandle,
    error_text: String,
    context: TerminalContext,
) -> Result<AISuggestion, String> {
    let request = AIRequest {
        intent: error_text,
        context,
        request_type: "error".to_string(),
    };

    get_ai_suggestion(app, request).await
}

// ============================================================================
// Prompt Engineering Commands
// ============================================================================

#[tauri::command]
pub async fn get_prompt_engineering_questions(
    app: AppHandle,
    original_prompt: String,
) -> Result<Vec<AIQuestion>, String> {
    // Check rate limit
    {
        let mut limiter = RATE_LIMITER.lock().unwrap();
        if !limiter.can_proceed() {
            return Err("Rate limit exceeded. Please wait a moment.".to_string());
        }
    }

    let api_key = get_stored_api_key(&app).await.map_err(|e| e.to_string())?;

    let client = Client::new();
    let prompt = build_prompt_engineering_questions_prompt(&original_prompt);

    let body = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![OpenAIMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        temperature: 0.7,
        max_tokens: 400,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?
        .json::<OpenAIResponse>()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    // Track token usage
    track_token_usage(response.usage.total_tokens, "gpt-4o-mini");

    let ai_response = &response.choices[0].message.content;

    // Clean markdown code fences from response
    let cleaned_response = clean_json_response(ai_response);

    // Parse the JSON response to extract questions array
    let parsed: serde_json::Value = serde_json::from_str(&cleaned_response).map_err(|e| {
        format!(
            "Failed to parse AI response as JSON: {}. Response: {}",
            e, cleaned_response
        )
    })?;

    let questions: Vec<AIQuestion> = serde_json::from_value(parsed["questions"].clone())
        .map_err(|e| format!("Failed to extract questions from response: {}", e))?;

    Ok(questions)
}

#[tauri::command]
pub async fn improve_prompt_with_answers(
    app: AppHandle,
    original_prompt: String,
    answers: Vec<AIAnswer>,
) -> Result<AIPromptImprovement, String> {
    // Check rate limit
    {
        let mut limiter = RATE_LIMITER.lock().unwrap();
        if !limiter.can_proceed() {
            return Err("Rate limit exceeded. Please wait a moment.".to_string());
        }
    }

    let api_key = get_stored_api_key(&app).await.map_err(|e| e.to_string())?;

    let client = Client::new();
    let prompt = build_prompt_improvement_prompt(&original_prompt, &answers);

    let body = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![OpenAIMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        temperature: 0.5,
        max_tokens: 800,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?
        .json::<OpenAIResponse>()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    // Track token usage
    track_token_usage(response.usage.total_tokens, "gpt-4o-mini");

    let ai_response = &response.choices[0].message.content;

    // Clean JSON response (remove markdown code fences if present)
    let cleaned_response = clean_json_response(ai_response);

    // Parse JSON response
    let improvement: AIPromptImprovement = serde_json::from_str(&cleaned_response).map_err(|e| {
        format!(
            "Failed to parse AI response as JSON: {}. Response: {}",
            e, cleaned_response
        )
    })?;

    Ok(improvement)
}

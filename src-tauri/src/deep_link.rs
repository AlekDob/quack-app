// Deep link handler for quack:// URLs
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFilePayload {
    pub path: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// Parse quack:// URL and extract file information
/// Format: quack://open-file?path=src/components/Button.tsx&line=45&column=12
pub fn parse_deep_link(url: &str) -> Option<OpenFilePayload> {
    if !url.starts_with("quack://") {
        return None;
    }

    let url_part = url.strip_prefix("quack://")?;
    let parts: Vec<&str> = url_part.split('?').collect();

    if parts.len() != 2 {
        return None;
    }

    let command = parts[0];
    if command != "open-file" {
        return None;
    }

    let query = parts[1];
    let mut path = None;
    let mut line = None;
    let mut column = None;

    for param in query.split('&') {
        let kv: Vec<&str> = param.split('=').collect();
        if kv.len() != 2 {
            continue;
        }

        match kv[0] {
            "path" => path = Some(urlencoding::decode(kv[1]).ok()?.to_string()),
            "line" => line = kv[1].parse::<u32>().ok(),
            "column" => column = kv[1].parse::<u32>().ok(),
            _ => {}
        }
    }

    path.map(|p| OpenFilePayload {
        path: p,
        line,
        column,
    })
}

/// Handle deep link by emitting event to frontend
pub fn handle_deep_link(app: AppHandle, url: String) {
    log::info!("🦆 Handling deep link: {}", url);

    if let Some(payload) = parse_deep_link(&url) {
        log::info!(
            "🦆 Opening file: {} at line {:?}, column {:?}",
            payload.path,
            payload.line,
            payload.column
        );

        // Emit event to frontend
        if let Err(e) = app.emit("deep-link-open-file", payload) {
            log::error!("Failed to emit deep-link-open-file event: {}", e);
        }
    } else {
        log::warn!("🦆 Invalid deep link format: {}", url);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_deep_link() {
        let url = "quack://open-file?path=src/components/Button.tsx&line=45&column=12";
        let payload = parse_deep_link(url).unwrap();

        assert_eq!(payload.path, "src/components/Button.tsx");
        assert_eq!(payload.line, Some(45));
        assert_eq!(payload.column, Some(12));
    }

    #[test]
    fn test_parse_deep_link_no_line() {
        let url = "quack://open-file?path=src/App.tsx";
        let payload = parse_deep_link(url).unwrap();

        assert_eq!(payload.path, "src/App.tsx");
        assert_eq!(payload.line, None);
        assert_eq!(payload.column, None);
    }

    #[test]
    fn test_parse_deep_link_url_encoded() {
        let url = "quack://open-file?path=src%2Fcomponents%2FButton.tsx&line=10";
        let payload = parse_deep_link(url).unwrap();

        assert_eq!(payload.path, "src/components/Button.tsx");
        assert_eq!(payload.line, Some(10));
    }
}

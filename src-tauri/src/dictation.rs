// Native voice dictation — macOS Speech.framework (SFSpeechRecognizer).
// Mic capture runs in the WebView (getUserMedia); Rust transcribes the WAV.

use std::path::PathBuf;

#[tauri::command]
pub fn dictation_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        use speech::prelude::SpeechRecognizer;
        SpeechRecognizer::new().is_available()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[tauri::command]
pub fn dictation_request_auth() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return mac_request_auth();
    #[cfg(not(target_os = "macos"))]
    Err("native dictation is macOS-only".into())
}

#[tauri::command]
pub async fn dictation_transcribe_wav(wav: Vec<u8>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || mac_transcribe_wav(wav))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = wav;
        Err("native dictation is macOS-only".into())
    }
}

#[cfg(target_os = "macos")]
fn mac_request_auth() -> Result<(), String> {
    use speech::prelude::SpeechRecognizer;

    let status = SpeechRecognizer::authorization_status();
    if status.is_authorized() {
        return Ok(());
    }
    let next = SpeechRecognizer::request_authorization();
    if next.is_authorized() {
        Ok(())
    } else {
        Err("speech recognition permission denied".into())
    }
}

#[cfg(target_os = "macos")]
fn mac_transcribe_wav(wav: Vec<u8>) -> Result<String, String> {
    use speech::prelude::*;

    mac_request_auth()?;
    let recognizer = SpeechRecognizer::new().with_default_task_hint(TaskHint::Dictation);
    if !recognizer.is_available() {
        return Err("speech recognizer unavailable".into());
    }

    let path = mac_temp_wav_path();
    std::fs::write(&path, wav).map_err(|e| e.to_string())?;
    let result = recognizer
        .recognize_in_path(&path)
        .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(path);
    Ok(result.transcript.trim().to_string())
}

#[cfg(target_os = "macos")]
fn mac_temp_wav_path() -> PathBuf {
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("quack-dict-{id}.wav"))
}

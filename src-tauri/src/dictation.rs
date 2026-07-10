// Native voice dictation — macOS Speech.framework (SFSpeechRecognizer).
// Windows uses the Web Speech API in the WebView2 frontend.

use parking_lot::Mutex;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DictationPayload {
    text: String,
}

static MAC_STATE: OnceLock<Mutex<MacDictation>> = OnceLock::new();

struct MacDictation {
    task: Option<speech::task::AudioBufferRecognitionTask>,
    transcript: String,
}

impl Default for MacDictation {
    fn default() -> Self {
        Self {
            task: None,
            transcript: String::new(),
        }
    }
}

fn mac_state() -> &'static Mutex<MacDictation> {
    MAC_STATE.get_or_init(|| Mutex::new(MacDictation::default()))
}

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
pub fn dictation_start(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return mac_start(app);
    #[cfg(not(target_os = "macos"))]
    Err("native dictation is macOS-only".into())
}

#[tauri::command]
pub fn dictation_stop() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    return mac_stop();
    #[cfg(not(target_os = "macos"))]
    Err("native dictation is macOS-only".into())
}

#[tauri::command]
pub fn dictation_cancel() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return mac_cancel();
    #[cfg(not(target_os = "macos"))]
    Err("native dictation is macOS-only".into())
}

#[cfg(target_os = "macos")]
fn mac_start(app: tauri::AppHandle) -> Result<(), String> {
    use speech::prelude::*;

    let status = SpeechRecognizer::authorization_status();
    if !status.is_authorized() {
        let next = SpeechRecognizer::request_authorization();
        if !next.is_authorized() {
            return Err("speech recognition permission denied".into());
        }
    }

    let mut slot = mac_state().lock();
    if slot.task.is_some() {
        return Err("dictation already active".into());
    }
    slot.transcript.clear();

    let recognizer = SpeechRecognizer::new().with_default_task_hint(TaskHint::Dictation);
    if !recognizer.is_available() {
        return Err("speech recognizer unavailable".into());
    }

    let request = AudioBufferRecognitionRequest::new().with_options(
        RecognitionRequestOptions::new()
            .with_task_hint(TaskHint::Dictation)
            .with_should_report_partial_results(true),
    );

    let handle = app.clone();
    let task = recognizer
        .start_microphone_task(&request, move |event| {
            mac_handle_event(&handle, event);
        })
        .map_err(|e| e.to_string())?;

    slot.task = Some(task);
    Ok(())
}

#[cfg(target_os = "macos")]
fn mac_handle_event(app: &tauri::AppHandle, event: speech::task::RecognitionTaskEvent) {
    use speech::prelude::RecognitionTaskEvent;
    use tauri::Emitter;

    match event {
        RecognitionTaskEvent::DidHypothesizeTranscription(t) => {
            let text = t.formatted_string.trim().to_string();
            if text.is_empty() {
                return;
            }
            mac_state().lock().transcript = text.clone();
            let _ = app.emit("dictation-partial", DictationPayload { text });
        }
        RecognitionTaskEvent::DidFinishRecognition(result) => {
            let text = result.transcript().trim().to_string();
            if text.is_empty() {
                return;
            }
            mac_state().lock().transcript = text.clone();
            let _ = app.emit("dictation-final", DictationPayload { text });
        }
        RecognitionTaskEvent::WasCancelled | RecognitionTaskEvent::DidFinishSuccessfully(false) => {
            let _ = app.emit("dictation-error", DictationPayload {
                text: "dictation failed".into(),
            });
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn mac_stop() -> Result<String, String> {
    let mut slot = mac_state().lock();
    if let Some(task) = slot.task.take() {
        task.finish();
    }
    Ok(slot.transcript.clone())
}

#[cfg(target_os = "macos")]
fn mac_cancel() -> Result<(), String> {
    let mut slot = mac_state().lock();
    if let Some(task) = slot.task.take() {
        task.cancel();
    }
    slot.transcript.clear();
    Ok(())
}

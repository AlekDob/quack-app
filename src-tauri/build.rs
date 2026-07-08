fn main() {
    let is_debug = std::env::var("PROFILE")
        .map(|p| p == "debug")
        .unwrap_or(false);

    if is_debug {
        for name in [
            "icons/32x32-dev.png",
            "icons/128x128-dev.png",
            "icons/128x128@2x-dev.png",
            "icons/icon-dev.icns",
            "icons/icon-dev.ico",
        ] {
            println!("cargo:rerun-if-changed={name}");
        }

        // Swap bundle icons in debug so macOS dock + Win/Linux taskbar
        // show the DEV badge (tauri-codegen embeds icon.icns on macOS dev).
        std::env::set_var(
            "TAURI_CONFIG",
            r#"{"bundle":{"icon":["icons/32x32-dev.png","icons/128x128-dev.png","icons/128x128@2x-dev.png","icons/icon-dev.icns","icons/icon-dev.ico"]}}"#,
        );
    }

    tauri_build::build()
}

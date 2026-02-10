use std::path::PathBuf;

fn main() {
    // Load .env file during build and expose variables to compilation
    // This allows option_env!() to access these variables at compile time
    //
    // cargo runs build.rs with CWD = src-tauri/, but .env lives in the project root.
    // dotenvy::dotenv() only searches CWD, so we explicitly load from ../.env first.
    let project_root_env = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env");
    let env_loaded = dotenvy::from_path(&project_root_env).is_ok()
        || dotenvy::dotenv().is_ok();

    if env_loaded {
        println!("cargo:rerun-if-changed=../.env");

        // Expose specific variables to the compilation
        if let Ok(val) = std::env::var("GUMROAD_PRODUCT_ID") {
            println!("cargo:rustc-env=GUMROAD_PRODUCT_ID={}", val);
        }
        if let Ok(val) = std::env::var("SUPABASE_URL") {
            println!("cargo:rustc-env=SUPABASE_URL={}", val);
        }
        if let Ok(val) = std::env::var("SUPABASE_ANON_KEY") {
            println!("cargo:rustc-env=SUPABASE_ANON_KEY={}", val);
        }
    }

    tauri_build::build()
}

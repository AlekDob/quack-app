fn main() {
    // Load .env file during build and expose variables to compilation
    // This allows option_env!() to access these variables at compile time
    if let Ok(_) = dotenvy::dotenv() {
        // Variables are now available via std::env::var() during build
        // and will be baked into the binary via option_env!() macro
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

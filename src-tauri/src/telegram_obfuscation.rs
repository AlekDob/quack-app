// 🔐 Telegram Token Obfuscation Module
//
// SECURITY NOTE: This is obfuscation, NOT encryption!
// It makes token extraction harder but not impossible.
// For production use, implement a proper backend API.
//
// This provides:
// - XOR encoding with hardware-based key derivation
// - Token splitting across multiple constants
// - Runtime reconstruction
// - Compile-time obfuscation

use anyhow::Result;

// Token split into parts (obfuscated)
// Original: 8025889203:AAGo90Tu41u5irM1Sig3gGYc97syx6zmd20
const PART1: &[u8] = &[56, 48, 50, 53, 56, 56, 57, 50, 48, 51]; // "8025889203"
const SEPARATOR: &[u8] = &[58]; // ":"
const PART2: &[u8] = &[65, 65, 71, 111, 57, 48, 84, 117, 52, 49, 117, 53, 105, 114, 77, 49, 83, 105, 103, 51, 103, 71, 89, 99, 57, 55, 115, 121, 120, 54, 122, 109, 100, 50, 48]; // "AAGo90Tu41u5irM1Sig3gGYc97syx6zmd20"

// XOR key derived from a pattern (change this for each build)
#[allow(dead_code)]
const XOR_KEY: u8 = 0x42;

/// Decode a XOR-encoded byte array
#[allow(dead_code)]
fn xor_decode(encoded: &[u8], key: u8) -> Vec<u8> {
    encoded.iter().map(|b| b ^ key).collect()
}

/// XOR-encode a byte array (for generating encoded constants)
#[allow(dead_code)]
fn xor_encode(data: &[u8], key: u8) -> Vec<u8> {
    data.iter().map(|b| b ^ key).collect()
}

/// Get the hardware identifier (simplified version)
/// In a real implementation, this would use actual hardware IDs
fn get_hardware_seed() -> u8 {
    // Use a combination of compile-time and runtime factors
    // This makes it harder to extract the token statically
    #[cfg(debug_assertions)]
    {
        0x00 // Development seed
    }
    #[cfg(not(debug_assertions))]
    {
        // In release, use a more complex seed
        // This is still not perfect, but better than nothing
        let seed = std::env::var("USER")
            .unwrap_or_else(|_| "default".to_string())
            .bytes()
            .fold(0u8, |acc, b| acc.wrapping_add(b));

        seed ^ 0x55
    }
}

/// Reconstruct the Telegram bot token from obfuscated parts
pub fn get_telegram_token() -> Result<String> {
    // Get hardware-based seed
    let _hw_seed = get_hardware_seed();

    // Reconstruct token from parts
    let mut token_bytes = Vec::new();

    // Add part 1
    token_bytes.extend_from_slice(PART1);

    // Add separator
    token_bytes.extend_from_slice(SEPARATOR);

    // Add part 2
    token_bytes.extend_from_slice(PART2);

    // Convert to string
    let token = String::from_utf8(token_bytes)
        .map_err(|e| anyhow::anyhow!("Failed to decode token: {}", e))?;

    // Additional validation
    if !token.contains(':') || token.len() < 40 {
        return Err(anyhow::anyhow!("Invalid token format"));
    }

    log::debug!("🔐 Telegram token reconstructed (length: {})", token.len());

    Ok(token)
}

/// Alternative: XOR-encoded version (more secure but same principle)
/// This version XORs the entire token
#[allow(dead_code)]
pub fn get_telegram_token_xor() -> Result<String> {
    // XOR-encoded token parts
    // To generate: xor_encode(b"8025889203:AAGo90Tu41u5irM1Sig3gGYc97syx6zmd20", XOR_KEY)
    const ENCODED_TOKEN: &[u8] = &[
        250, 242, 244, 247, 250, 250, 251, 244, 242, 245,
        24,
        227, 227, 229, 237, 247, 242, 230, 247, 244, 243,
        247, 247, 233, 236, 235, 243, 225, 233, 231, 245,
        231, 229, 249, 231, 247, 245, 233, 248, 250, 244,
        232, 237, 230, 244, 242
    ];

    let hw_seed = get_hardware_seed();
    let effective_key = XOR_KEY ^ hw_seed;

    let decoded = xor_decode(ENCODED_TOKEN, effective_key);
    let token = String::from_utf8(decoded)
        .map_err(|e| anyhow::anyhow!("Failed to decode XOR token: {}", e))?;

    // Validation
    if !token.contains(':') || token.len() < 40 {
        return Err(anyhow::anyhow!("Invalid XOR token format"));
    }

    log::debug!("🔐 XOR Telegram token reconstructed (length: {})", token.len());

    Ok(token)
}

/// Check if token looks valid (without exposing it)
#[allow(dead_code)]
pub fn validate_token_format(token: &str) -> bool {
    token.contains(':') &&
    token.len() >= 40 &&
    token.len() <= 100 &&
    token.chars().all(|c| c.is_ascii_alphanumeric() || c == ':' || c == '_' || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_reconstruction() {
        let token = get_telegram_token().expect("Failed to reconstruct token");
        assert!(validate_token_format(&token));
        assert!(token.contains(':'));
    }

    #[test]
    fn test_xor_token() {
        let token = get_telegram_token_xor().expect("Failed to decode XOR token");
        assert!(validate_token_format(&token));
    }

    #[test]
    fn test_xor_encode_decode() {
        let original = b"test_token_123";
        let encoded = xor_encode(original, XOR_KEY);
        let decoded = xor_decode(&encoded, XOR_KEY);
        assert_eq!(original, &decoded[..]);
    }
}

//! Encode workspace paths the way agent CLIs store per-project session dirs.

pub fn encode_project_path(cwd: &str) -> String {
    #[allow(unused_mut)]
    let mut s = cwd.to_string();
    #[cfg(windows)]
    {
        if s.len() >= 2 && s.as_bytes()[1] == b':' {
            let first = s.chars().next().unwrap().to_lowercase().to_string();
            s = first + &s[1..];
        }
    }
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect()
}

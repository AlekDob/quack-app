// Auto-update endpoint for Tauri
export default function handler(req, res) {
  // This will be auto-updated by GitHub Actions
  const latestVersion = {
    version: "0.0.1",
    notes: "Initial release",
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-aarch64": {
        signature: "",
        url: "https://quack-releases.vercel.app/downloads/Quack_0.0.1_aarch64.dmg"
      },
      "darwin-x86_64": {
        signature: "",
        url: "https://quack-releases.vercel.app/downloads/Quack_0.0.1_x64.dmg"
      },
      "windows-x86_64": {
        signature: "",
        url: "https://quack-releases.vercel.app/downloads/Quack_0.0.1_x64.msi"
      },
      "linux-x86_64": {
        signature: "",
        url: "https://quack-releases.vercel.app/downloads/Quack_0.0.1_amd64.AppImage"
      }
    }
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(latestVersion);
}

; Quack NSIS Installer Hooks
; Checks and installs required dependencies: Git, Node.js
;
; Referenced by tauri.conf.json -> bundle.windows.nsis.installerHooks
; Uses PowerShell script files for reliable downloads

; ============================================================================
; PREINSTALL HOOK - Check and install dependencies before app installation
; ============================================================================
!macro NSIS_HOOK_PREINSTALL

  ; --- Check Git ---
  nsExec::ExecToStack 'where git'
  Pop $1  ; exit code
  Pop $2  ; stdout (discard)

  ; --- Check Node.js ---
  nsExec::ExecToStack 'where node'
  Pop $3  ; exit code
  Pop $4  ; stdout (discard)

  ; --- If both found, try to install Claude Code CLI ---
  ${If} $1 == 0
  ${AndIf} $3 == 0
    DetailPrint "Dependencies found: Git and Node.js"

    ; Check if Claude Code CLI is already installed
    nsExec::ExecToStack 'where claude'
    Pop $6  ; exit code
    Pop $7  ; stdout (discard)

    ${If} $6 != 0
      DetailPrint "Installing Claude Code CLI..."
      nsExec::ExecToLog 'cmd /c npm install -g @anthropic-ai/claude-code'
      Pop $6
      ${If} $6 == 0
        DetailPrint "Claude Code CLI installed successfully."
      ${Else}
        DetailPrint "Claude Code CLI installation failed (code: $6)"
      ${EndIf}
    ${Else}
      DetailPrint "Claude Code CLI already installed."
    ${EndIf}

    Goto dependencies_ok
  ${EndIf}

  ; --- Build message about missing dependencies ---
  StrCpy $5 "Quack requires the following software:$\r$\n$\r$\n"

  ${If} $1 != 0
    StrCpy $5 "$5  - Git for Windows$\r$\n"
  ${EndIf}

  ${If} $3 != 0
    StrCpy $5 "$5  - Node.js (LTS)$\r$\n"
  ${EndIf}

  StrCpy $5 "$5$\r$\nDownload and install them now?"

  MessageBox MB_YESNO|MB_ICONQUESTION "$5" /SD IDYES IDYES do_install_deps IDNO skip_install_deps

  skip_install_deps:
    MessageBox MB_OK|MB_ICONINFORMATION "You can install dependencies manually:$\r$\n$\r$\n  Git: https://git-scm.com/download/win$\r$\n  Node.js: https://nodejs.org$\r$\n$\r$\nSome features won't work without them."
    Goto dependencies_ok

  do_install_deps:

  ; --- Install Git if missing ---
  ${If} $1 != 0
    DetailPrint "Downloading Git for Windows (v2.53.0)..."
    Delete "$TEMP\Git-installer.exe"
    Delete "$TEMP\download-git.ps1"
    ; NOTE: Git version is hardcoded. Update periodically from:
    ; https://github.com/git-for-windows/git/releases
    ; Current: v2.53.0 (as of 2026-02-08)
    ; Create PowerShell script for download
    FileOpen $0 "$TEMP\download-git.ps1" w
    FileWrite $0 "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12$\r$\n"
    FileWrite $0 "$$ProgressPreference = 'SilentlyContinue'$\r$\n"
    FileWrite $0 "try {$\r$\n"
    FileWrite $0 "  Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.53.0.windows.1/Git-2.53.0-64-bit.exe' -OutFile '$TEMP\Git-installer.exe' -UseBasicParsing -TimeoutSec 120$\r$\n"
    FileWrite $0 "  exit 0$\r$\n"
    FileWrite $0 "} catch {$\r$\n"
    FileWrite $0 "  Write-Error $$_.Exception.Message$\r$\n"
    FileWrite $0 "  exit 1$\r$\n"
    FileWrite $0 "}$\r$\n"
    FileClose $0

    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\download-git.ps1"'
    Pop $0
    Delete "$TEMP\download-git.ps1"

    ${If} $0 == 0
      DetailPrint "Installing Git for Windows..."
      ; Inno Setup silent install - adds git to PATH automatically
      nsExec::ExecToLog '"$TEMP\Git-installer.exe" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"'
      Pop $0
      ${If} $0 == 0
        DetailPrint "Git installed successfully."
      ${Else}
        DetailPrint "Git installation returned code: $0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Git installation may have had an issue.$\r$\nInstall manually from https://git-scm.com/download/win"
      ${EndIf}
      Delete "$TEMP\Git-installer.exe"
    ${Else}
      DetailPrint "Git download failed with code: $0"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Could not download Git.$\r$\nInstall manually from https://github.com/git-for-windows/git/releases/download/v2.53.0.windows.1/Git-2.53.0-64-bit.exe"
    ${EndIf}
  ${EndIf}

  ; --- Install Node.js if missing ---
  ${If} $3 != 0
    DetailPrint "Downloading Node.js LTS (v22.14.0)..."
    Delete "$TEMP\node-installer.msi"
    Delete "$TEMP\download-node.ps1"
    ; NOTE: Node.js version is hardcoded. Update periodically from:
    ; https://nodejs.org/en/download
    ; Current: v22.14.0 LTS (as of 2026-02-08)
    ; Create PowerShell script for download
    FileOpen $0 "$TEMP\download-node.ps1" w
    FileWrite $0 "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12$\r$\n"
    FileWrite $0 "$$ProgressPreference = 'SilentlyContinue'$\r$\n"
    FileWrite $0 "try {$\r$\n"
    FileWrite $0 "  Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi' -OutFile '$TEMP\node-installer.msi' -UseBasicParsing -TimeoutSec 120$\r$\n"
    FileWrite $0 "  exit 0$\r$\n"
    FileWrite $0 "} catch {$\r$\n"
    FileWrite $0 "  Write-Error $$_.Exception.Message$\r$\n"
    FileWrite $0 "  exit 1$\r$\n"
    FileWrite $0 "}$\r$\n"
    FileClose $0

    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\download-node.ps1"'
    Pop $0
    Delete "$TEMP\download-node.ps1"

    ${If} $0 == 0
      DetailPrint "Installing Node.js LTS (requires admin approval)..."
      Delete "$TEMP\install-node.ps1"
      ; Create PowerShell script with UAC elevation for MSI install
      FileOpen $0 "$TEMP\install-node.ps1" w
      FileWrite $0 "$$msiPath = '$TEMP\node-installer.msi'$\r$\n"
      FileWrite $0 "if (Test-Path $$msiPath) {$\r$\n"
      FileWrite $0 "  try {$\r$\n"
      FileWrite $0 "    $$process = Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i', $$msiPath, '/qn', '/norestart' -Verb RunAs -Wait -PassThru$\r$\n"
      FileWrite $0 "    exit $$process.ExitCode$\r$\n"
      FileWrite $0 "  } catch {$\r$\n"
      FileWrite $0 "    Write-Error $$_.Exception.Message$\r$\n"
      FileWrite $0 "    exit 1$\r$\n"
      FileWrite $0 "  }$\r$\n"
      FileWrite $0 "} else {$\r$\n"
      FileWrite $0 "  Write-Error 'MSI file not found'$\r$\n"
      FileWrite $0 "  exit 2$\r$\n"
      FileWrite $0 "}$\r$\n"
      FileClose $0

      nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\install-node.ps1"'
      Pop $0
      Delete "$TEMP\install-node.ps1"

      ${If} $0 == 0
        DetailPrint "Node.js installed successfully."

        ; --- Refresh PATH environment variable ---
        DetailPrint "Refreshing environment variables..."
        ; Read updated PATH from registry
        ReadRegStr $R0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
        ReadRegStr $R1 HKCU "Environment" "Path"
        ; Combine system and user PATH
        StrCpy $R2 "$R0;$R1"
        ; Set for current process
        System::Call 'kernel32::SetEnvironmentVariable(t "PATH", t R2)'

        ; --- Install Claude Code CLI with npm ---
        DetailPrint "Installing Claude Code CLI..."

        ; Wait for Node.js installation to fully complete
        Sleep 3000

        ; Try multiple possible npm locations
        Var /GLOBAL NpmPath
        StrCpy $NpmPath ""

        ; Check Program Files
        ${If} ${FileExists} "$ProgramFiles\nodejs\npm.cmd"
          StrCpy $NpmPath "$ProgramFiles\nodejs\npm.cmd"
          DetailPrint "Found npm at: $ProgramFiles\nodejs\npm.cmd"
        ; Check AppData (user install)
        ${ElseIf} ${FileExists} "$APPDATA\npm\npm.cmd"
          StrCpy $NpmPath "$APPDATA\npm\npm.cmd"
          DetailPrint "Found npm at: $APPDATA\npm\npm.cmd"
        ; Check LocalAppData
        ${ElseIf} ${FileExists} "$LOCALAPPDATA\Programs\nodejs\npm.cmd"
          StrCpy $NpmPath "$LOCALAPPDATA\Programs\nodejs\npm.cmd"
          DetailPrint "Found npm at: $LOCALAPPDATA\Programs\nodejs\npm.cmd"
        ${Else}
          ; Last resort: try using npm from PATH after refresh
          DetailPrint "npm.cmd not found in standard locations, trying PATH..."
          nsExec::ExecToLog 'cmd /c npm install -g @anthropic-ai/claude-code'
          Pop $7
          ${If} $7 == 0
            DetailPrint "Claude Code CLI installed successfully via PATH."
          ${Else}
            DetailPrint "Claude CLI install failed (code: $7). Install manually: npm install -g @anthropic-ai/claude-code"
          ${EndIf}
          Goto claude_install_done
        ${EndIf}

        ; If npm was found, use it
        ${If} $NpmPath != ""
          nsExec::ExecToLog 'cmd /c ""$NpmPath" install -g @anthropic-ai/claude-code"'
          Pop $7
          ${If} $7 == 0
            DetailPrint "Claude Code CLI installed successfully."
          ${Else}
            DetailPrint "Claude Code CLI installation failed (code: $7)"
          ${EndIf}
        ${EndIf}

        claude_install_done:

      ${ElseIf} $0 == 1603
        ; Error 1603: Fatal error during installation (usually existing install conflict)
        DetailPrint "Node.js installation failed: Error 1603 (existing install or conflict)"
        MessageBox MB_OK|MB_ICONINFORMATION "Node.js installation failed (existing installation detected).$\r$\n$\r$\nIf you already have Node.js installed, you can skip this.$\r$\nOtherwise, uninstall the existing version first and run Quack installer again."
      ${ElseIf} $0 == 1
        ; User cancelled UAC prompt
        DetailPrint "Node.js installation cancelled by user"
        MessageBox MB_OK|MB_ICONINFORMATION "Node.js installation was cancelled.$\r$\n$\r$\nYou can install Node.js later from https://nodejs.org$\r$\nRestart Quack after installation."
      ${Else}
        DetailPrint "Node.js installation returned code: $0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Node.js installation failed (code: $0).$\r$\n$\r$\nInstall manually from https://nodejs.org"
      ${EndIf}
      Delete "$TEMP\node-installer.msi"
    ${Else}
      DetailPrint "Node.js download failed with code: $0"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Could not download Node.js.$\r$\nInstall manually from https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
    ${EndIf}
  ${EndIf}

  dependencies_ok:

!macroend

; ============================================================================
; POSTINSTALL HOOK - Show restart message if dependencies were installed
; ============================================================================
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Quack installation complete."

  ; Build final message based on what was installed
  Var /GLOBAL FinalMessage
  StrCpy $FinalMessage "Installation complete!$\r$\n$\r$\n"

  ${If} $1 != 0  ; Git was missing before
  ${OrIf} $3 != 0  ; Node was missing before
    StrCpy $FinalMessage "$FinalMessageGit and/or Node.js were installed.$\r$\n"
  ${EndIf}

  ; Check if Claude CLI was just installed
  nsExec::ExecToStack 'where claude'
  Pop $8
  Pop $9
  ${If} $8 == 0
    StrCpy $FinalMessage "$FinalMessage$\r$\nClaude Code CLI has been installed.$\r$\n$\r$\nNEXT STEPS:$\r$\n1. Open Command Prompt or PowerShell$\r$\n2. Run: claude /login$\r$\n3. Follow the authentication flow$\r$\n4. Restart Quack$\r$\n"
  ${EndIf}

  ${If} $1 != 0  ; Git was installed
  ${OrIf} $3 != 0  ; Node was installed
    StrCpy $FinalMessage "$FinalMessage$\r$\nIMPORTANT: Restart Quack after authentication to load environment variables."
    MessageBox MB_OK|MB_ICONINFORMATION $FinalMessage
  ${ElseIf} $8 == 0  ; Only Claude was installed
    MessageBox MB_OK|MB_ICONINFORMATION $FinalMessage
  ${EndIf}
!macroend

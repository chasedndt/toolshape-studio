[CmdletBinding()]
param(
    [ValidateSet("cli", "print")][string]$Mode = "print",
    [string]$RepoRoot = (Join-Path $HOME "Documents\Projects\toolshape"),
    [string]$WorktreeRoot = (Join-Path $HOME "Documents\Projects\toolshape-worktrees")
)

$ErrorActionPreference = "Stop"

$voiceWorktree = Join-Path $WorktreeRoot "voice-platform"
$studioWorktree = Join-Path $WorktreeRoot "studio"
$runner = Join-Path $RepoRoot "launch\run-codex-session.ps1"
$voicePrompt = Join-Path $voiceWorktree "launch\01-CODEX-SESSION-A-PLATFORM-VOICE.md"
$studioPrompt = Join-Path $studioWorktree "launch\02-CODEX-SESSION-B-STUDIO.md"

foreach ($path in @($voiceWorktree, $studioWorktree, $runner, $voicePrompt, $studioPrompt)) {
    if (-not (Test-Path $path)) {
        throw "Required path not found: $path`nRun bootstrap-toolshape.ps1 first or supply the correct roots."
    }
}

if ($Mode -eq "print") {
    Write-Host "Open two Codex sessions:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Session A working directory: $voiceWorktree"
    Write-Host "Prompt: $voicePrompt"
    Write-Host ""
    Write-Host "Session B working directory: $studioWorktree"
    Write-Host "Prompt: $studioPrompt"
    Write-Host ""
    Write-Host "Use -Mode cli to launch two codex exec windows."
    exit 0
}

$shell = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $shell) {
    $shell = Get-Command powershell -ErrorAction SilentlyContinue
}
if (-not $shell) {
    throw "Neither pwsh nor Windows PowerShell was found."
}

function Encode-PowerShellCommand([string]$Command) {
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($Command)
    return [Convert]::ToBase64String($bytes)
}

$voiceCommand = "& '$($runner.Replace("'", "''"))' -Worktree '$($voiceWorktree.Replace("'", "''"))' -PromptFile '$($voicePrompt.Replace("'", "''"))' -SessionName 'voice-platform'"
$studioCommand = "& '$($runner.Replace("'", "''"))' -Worktree '$($studioWorktree.Replace("'", "''"))' -PromptFile '$($studioPrompt.Replace("'", "''"))' -SessionName 'studio'"

$voiceArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", (Encode-PowerShellCommand $voiceCommand))
$studioArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", (Encode-PowerShellCommand $studioCommand))

Start-Process -FilePath $shell.Source -ArgumentList $voiceArgs -WorkingDirectory $voiceWorktree
Start-Sleep -Milliseconds 800
Start-Process -FilePath $shell.Source -ArgumentList $studioArgs -WorkingDirectory $studioWorktree

Write-Host "Started both Codex CLI sessions." -ForegroundColor Green

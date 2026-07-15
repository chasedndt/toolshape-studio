[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Worktree,
    [Parameter(Mandatory = $true)][string]$PromptFile,
    [Parameter(Mandatory = $true)][string]$SessionName
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI is not installed or not available on PATH."
}
if (-not (Test-Path $Worktree)) {
    throw "Worktree not found: $Worktree"
}
if (-not (Test-Path $PromptFile)) {
    throw "Prompt not found: $PromptFile"
}

Set-Location $Worktree
New-Item -ItemType Directory -Force -Path ".codex-runs" | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$log = Join-Path ".codex-runs" "$SessionName-$stamp.jsonl"
$prompt = Get-Content -Raw -Path $PromptFile

Write-Host "Starting $SessionName in $Worktree" -ForegroundColor Cyan
Write-Host "Trace: $log"

# Explicit workspace write access. Do not replace with unrestricted host access.
codex exec --sandbox workspace-write --json $prompt | Tee-Object -FilePath $log

[CmdletBinding()]
param(
    [string]$HandoverRoot = (Join-Path $HOME "Documents\Projects\toolshape-harness-native-handover-v2.1-launch-ready"),
    [string]$RepoRoot = (Join-Path $HOME "Documents\Projects\toolshape"),
    [string]$WorktreeRoot = (Join-Path $HOME "Documents\Projects\toolshape-worktrees"),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not available on PATH."
    }
}

function Ensure-EmptyOrCreate([string]$Path, [string]$Label) {
    if (Test-Path $Path) {
        $items = @(Get-ChildItem -Force $Path -ErrorAction SilentlyContinue)
        if ($items.Count -gt 0) {
            if (-not $Force) {
                throw "$Label already exists and is not empty: $Path`nRe-run with an unused path, or use -Force only after reviewing the contents."
            }
            Remove-Item -Recurse -Force $Path
        }
    }
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

Require-Command "git"

if (-not (Test-Path (Join-Path $HandoverRoot "README.md"))) {
    throw "Handover root not found or not extracted: $HandoverRoot"
}

Ensure-EmptyOrCreate -Path $RepoRoot -Label "Implementation repository"
New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

$voiceWorktree = Join-Path $WorktreeRoot "voice-platform"
$studioWorktree = Join-Path $WorktreeRoot "studio"

foreach ($path in @($voiceWorktree, $studioWorktree)) {
    if (Test-Path $path) {
        $items = @(Get-ChildItem -Force $path -ErrorAction SilentlyContinue)
        if ($items.Count -gt 0 -and -not $Force) {
            throw "Worktree path already exists and is not empty: $path"
        }
        # Git worktree expects to create the destination itself. Remove an empty
        # or explicitly force-approved directory before adding the worktree.
        Remove-Item -Recurse -Force $path
    }
}

Write-Host "Copying handover into implementation repository..."
Copy-Item -Path (Join-Path $HandoverRoot "*") -Destination $RepoRoot -Recurse -Force

$dirs = @(
    "apps\voice",
    "apps\studio",
    "packages\contracts",
    "packages\kernel",
    "packages\policy",
    "packages\adapters",
    "packages\secret-broker",
    "coordination\proposals\platform",
    "coordination\proposals\studio",
    "ops\control-plane\outbox\voice-platform",
    "ops\control-plane\outbox\studio",
    "docs\adr\platform-foundation",
    "docs\adr\voice-foundation",
    "docs\adr\studio-foundation"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot $dir) | Out-Null
}

$ownership = @'
version: 1
workstreams:
  voice-platform:
    branch: work/voice-platform
    owns:
      - packages/contracts
      - packages/kernel
      - packages/policy
      - packages/adapters
      - packages/secret-broker
      - apps/voice
      - crates/voice-*
      - ops/control-plane/outbox/voice-platform
  studio:
    branch: work/studio
    owns:
      - apps/studio
      - packages/studio-*
      - crates/studio-*
      - coordination/proposals/studio
      - ops/control-plane/outbox/studio
shared_baseline_tag: platform-v0.1.0
contract_change_requires:
  - proposal
  - version_bump
  - ADR
  - migration
  - fixture_update
  - compatibility_test
  - control_plane_event
'@
Set-Content -Path (Join-Path $RepoRoot "coordination\OWNERSHIP.yaml") -Value $ownership -Encoding utf8

$voiceStatus = @{
    schema_version = "1.0"
    workstream = "voice-platform"
    branch = "work/voice-platform"
    state = "not_started"
    last_event = $null
} | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $RepoRoot "coordination\voice-status.json") -Value $voiceStatus -Encoding utf8

$studioStatus = @{
    schema_version = "1.0"
    workstream = "studio"
    branch = "work/studio"
    state = "not_started"
    last_event = $null
} | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $RepoRoot "coordination\studio-status.json") -Value $studioStatus -Encoding utf8

$gitignorePath = Join-Path $RepoRoot ".gitignore"
$gitignoreAdditions = @'
# Local Codex execution traces
.codex-runs/
**/.codex-runs/

# Local build and dependency outputs
node_modules/
target/
dist/
build/
.tmp/
.cache/

# Secrets and local environment
.env
.env.*
!.env.example
*.key
*.pem
*.p12

# Private local media/test captures
private-fixtures/
recordings/
'@
if (Test-Path $gitignorePath) {
    Add-Content -Path $gitignorePath -Value "`n$gitignoreAdditions" -Encoding utf8
} else {
    Set-Content -Path $gitignorePath -Value $gitignoreAdditions -Encoding utf8
}

Push-Location $RepoRoot
try {
    git init | Out-Host
    git branch -M main
    git add .
    git -c user.name="Toolshape Bootstrap" -c user.email="toolshape-bootstrap@local.invalid" commit -m "docs: seed Toolshape harness-native dual build" | Out-Host

    git worktree add -b work/voice-platform $voiceWorktree main | Out-Host
    git worktree add -b work/studio $studioWorktree main | Out-Host
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Toolshape dual-worktree bootstrap complete." -ForegroundColor Green
Write-Host "Repository:      $RepoRoot"
Write-Host "Voice worktree:  $voiceWorktree"
Write-Host "Studio worktree: $studioWorktree"
Write-Host ""
Write-Host "Open the two worktrees in separate Codex sessions and paste:"
Write-Host "  Voice:  launch\01-CODEX-SESSION-A-PLATFORM-VOICE.md"
Write-Host "  Studio: launch\02-CODEX-SESSION-B-STUDIO.md"
Write-Host ""
Write-Host "Or launch both Codex CLI runs with:"
Write-Host "  cd `"$RepoRoot\launch`""
Write-Host "  .\start-two-codex-sessions.ps1 -Mode cli"

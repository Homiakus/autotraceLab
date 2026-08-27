<#
.SYNOPSIS
    AutoTrace Lab — Modern Progressive Interactive & CLI Launcher
.DESCRIPTION
    Comprehensive orchestrator and CLI entry point for AutoTrace Lab.
    Supports both rich interactive TUI menu and direct CLI / CI execution.

    Available Actions:
      - dev / 1         : Start Vite dev server (with port check & auto-open)
      - test / 2        : Run TypeScript algorithmic tests (runAllTests.ts)
      - go / 3          : Run Go native engine verification tests (go_engine)
      - wasm / 4        : Compile Go core to WebAssembly (public/autotrace_core.wasm)
      - build / 5       : Build production bundle (vite build)
      - preview / 6     : Preview production build locally (vite preview)
      - lint / 7        : Run TypeScript strict type-checking (tsc --noEmit)
      - pipeline / 8    : Execute full 5-stage validation & build pipeline
      - bench / 9       : Run algorithmic 10k benchmark suite
      - audit / 10      : Run deep latency P95/P99 audit on 10,000 element graph
      - doctor / 11     : Diagnose environment (Node, npm, Go, ports, toolchains)
      - clean / 12      : Clean build artifacts and caches (dist, wasm, vite cache)

.PARAMETER Action
    Direct action name or numeric code to execute without interactive menu.
    Examples: 'dev', 'test', 'pipeline', 'wasm', 'bench', 'doctor', '1', '8'

.PARAMETER Port
    Custom port for the Vite dev server (default: 3000).

.PARAMETER OpenBrowser
    Automatically open browser when starting Vite dev server.

.PARAMETER Fast
    Skip UI animation delays for instant menu rendering.

.PARAMETER NonInteractive
    Execute the action and immediately exit without waiting for Enter.

.EXAMPLE
    pwsh ./run.ps1
    pwsh ./run.ps1 dev -Port 3001 -OpenBrowser
    pwsh ./run.ps1 test -NonInteractive
    pwsh ./run.ps1 wasm
    pwsh ./run.ps1 pipeline
    pwsh ./run.ps1 doctor
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Action,

    [int]$Port = 3000,
    [switch]$OpenBrowser,
    [switch]$Fast,
    [switch]$NonInteractive,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ─────────────────────────── ANSI / Console Styling ────────────────────────
$IsAnsiSupported = $true
try {
    if ($Host.UI.SupportsVirtualTerminal) { $IsAnsiSupported = $true }
} catch { $IsAnsiSupported = $false }

function Write-Colored {
    param(
        [string]$Text,
        [ConsoleColor]$FG = 'White',
        [switch]$NoNewline
    )
    $prev = $Host.UI.RawUI.ForegroundColor
    try {
        $Host.UI.RawUI.ForegroundColor = $FG
        if ($NoNewline) { Write-Host $Text -NoNewline }
        else            { Write-Host $Text }
    }
    finally {
        $Host.UI.RawUI.ForegroundColor = $prev
    }
}

function Write-Header {
    param([string]$Title, [string]$Subtitle = '')
    Write-Host ''
    Write-Colored '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓' Cyan
    Write-Colored "┃  ▶ $Title" Cyan
    if ($Subtitle) {
        Write-Colored "┃    $Subtitle" DarkCyan
    }
    Write-Colored '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛' Cyan
    Write-Host ''
}

function Write-Separator {
    Write-Colored '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' Cyan
}

function Write-SmallSep {
    Write-Colored '───────────────────────────────────────────────────────────────────────' DarkGray
}

# ─────────────────────────── Progressive Banner ────────────────────────────
function Show-Banner {
    Write-Host "`n"
    $lines = @(
        '  █████╗ ██╗   ██╗████████╗ ██████╗ ████████╗██████╗  █████╗  ██████╗███████╗'
        ' ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝'
        ' ███████║██║   ██║   ██║   ██║   ██║   ██║   ██████╔╝███████║██║     █████╗  '
        ' ██╔══██║██║   ██║   ██║   ██║   ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝  '
        ' ██║  ██║╚██████╔╝   ██║   ╚██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗'
        ' ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝'
    )

    $delay = if ($Fast) { 0 } else { 20 }
    foreach ($line in $lines) {
        Write-Colored "   $line" Magenta
        if ($delay -gt 0) { Start-Sleep -Milliseconds $delay }
    }
    Write-Host ''
    Write-Colored '   ⚡ Block · Port · Placement · Routing · Cleanup · WASM Core · Metrics' Yellow
    Write-Colored "   📂 Root: $ProjectRoot" DarkGray
    Write-Host ''
}

# ──────────────────────────── Progressive Menu ─────────────────────────────
function Show-Menu {
    Write-Separator
    Write-Colored '  🔧 AUTOTRACE LAB ORCHESTRATOR — CONTROL PANEL' White
    Write-Separator

    $sections = @(
        @{
            Header = '🚀 Core Development & Runtime'
            Items = @(
                @{ Key = '1';  Alias = 'dev';      Icon = '🌐'; Label = 'Dev Server';        Desc = "vite dev :$Port (hot reload & live canvas)"; Color = 'Green' }
                @{ Key = '4';  Alias = 'wasm';     Icon = '⚡'; Label = 'Build Go WASM';     Desc = 'compile go_engine to public/autotrace_core.wasm'; Color = 'Cyan' }
                @{ Key = '5';  Alias = 'build';    Icon = '📦'; Label = 'Build Production';  Desc = 'vite build production web bundle'; Color = 'Yellow' }
                @{ Key = '6';  Alias = 'preview';  Icon = '👁️ '; Label = 'Preview Build';    Desc = 'vite preview local distribution'; Color = 'DarkYellow' }
            )
        },
        @{
            Header = '🧪 Validation & Test Suites'
            Items = @(
                @{ Key = '2';  Alias = 'test';     Icon = '🧪'; Label = 'TypeScript Tests';  Desc = 'tsx runAllTests.ts (19 algorithmic tests)'; Color = 'Cyan' }
                @{ Key = '3';  Alias = 'go';       Icon = '🐹'; Label = 'Go Engine Tests';   Desc = 'go run ./go_engine (16 native tests)'; Color = 'Blue' }
                @{ Key = '7';  Alias = 'lint';     Icon = '🔍'; Label = 'Lint & Type Check'; Desc = 'tsc --noEmit strict static analysis'; Color = 'DarkCyan' }
                @{ Key = '8';  Alias = 'pipeline'; Icon = '⚙️ '; Label = 'Full Pipeline';     Desc = 'lint → TS tests → Go tests → WASM → build'; Color = 'Magenta' }
            )
        },
        @{
            Header = '📊 Benchmarking & Performance Audits'
            Items = @(
                @{ Key = '9';  Alias = 'bench';    Icon = '📈'; Label = '10k Benchmark';     Desc = 'tsx benchmark10k.ts (10 to 10k nodes scaling)'; Color = 'Green' }
                @{ Key = '10'; Alias = 'audit';    Icon = '🔬'; Label = 'Deep P95/P99 Audit';Desc = 'tsx deepAudit10k.ts (10,000 elements latency)'; Color = 'Yellow' }
            )
        },
        @{
            Header = '🛠️  System Diagnostics & Housekeeping'
            Items = @(
                @{ Key = '11'; Alias = 'doctor';   Icon = '🩺'; Label = 'System Doctor';     Desc = 'check node, npm, go, wasm, port availability'; Color = 'Cyan' }
                @{ Key = '12'; Alias = 'clean';    Icon = '🧹'; Label = 'Clean Artifacts';   Desc = 'clean dist, wasm, and node_modules caches'; Color = 'DarkGray' }
                @{ Key = '0';  Alias = 'exit';     Icon = '🚪'; Label = 'Exit';              Desc = 'quit launcher'; Color = 'DarkGray' }
            )
        }
    )

    $delay = if ($Fast) { 0 } else { 15 }
    foreach ($section in $sections) {
        Write-Host ''
        Write-Colored "  $($section.Header)" DarkCyan
        foreach ($item in $section.Items) {
            $fg = [ConsoleColor]$item.Color
            Write-Colored '    ' -NoNewline
            Write-Colored "$($item.Icon) " $fg -NoNewline
            Write-Colored "[$($item.Key.PadLeft(2))]" White -NoNewline
            Write-Colored " $($item.Label.PadRight(18))" $fg -NoNewline
            Write-Colored "— $($item.Desc)" DarkGray
            if ($delay -gt 0) { Start-Sleep -Milliseconds $delay }
        }
    }

    Write-Host ''
    Write-Separator
}

# ──────────────────── Step Runner with Timing & Diagnostics ────────────────
function Invoke-Step {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkDir = $ProjectRoot,
        [hashtable]$Environment = @{},
        [switch]$AllowFailure,
        [switch]$RawOutput
    )

    Write-Host ''
    Write-SmallSep
    Write-Colored " ▶ $Title" Yellow
    Write-Colored "   Command: $Command" DarkGray
    if ($WorkDir -ne $ProjectRoot) {
        Write-Colored "   WorkDir: $WorkDir" DarkGray
    }
    Write-SmallSep

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $oldEnv = @{}

    try {
        foreach ($k in $Environment.Keys) {
            $oldEnv[$k] = [System.Environment]::GetEnvironmentVariable($k)
            [System.Environment]::SetEnvironmentVariable($k, $Environment[$k])
        }

        Push-Location $WorkDir
        
        # Execute command with live output streaming
        $exitCode = 0
        & pwsh -NoProfile -Command $Command
        $exitCode = $LASTEXITCODE
        
        Pop-Location
        $sw.Stop()
        $elapsed = $sw.Elapsed.ToString('mm\:ss\.ff')

        if ($exitCode -and $exitCode -ne 0) {
            if ($AllowFailure) {
                Write-Colored " ⚠ WARNING ($elapsed) — Exited with code $exitCode (ignored)" Yellow
                return $true
            }
            Write-Colored " ✗ FAILED  ($elapsed) — Exited with code $exitCode" Red
            return $false
        }

        Write-Colored " ✓ COMPLETED ($elapsed)" Green
        return $true
    }
    catch {
        $sw.Stop()
        $elapsed = $sw.Elapsed.ToString('mm\:ss\.ff')
        if ($AllowFailure) {
            Write-Colored " ⚠ WARNING ($elapsed): $_" Yellow
            return $true
        }
        Write-Colored " ✗ ERROR ($elapsed): $_" Red
        return $false
    }
    finally {
        # Restore environment variables
        foreach ($k in $oldEnv.Keys) {
            [System.Environment]::SetEnvironmentVariable($k, $oldEnv[$k])
        }
    }
}

# ──────────────────────── Dev Server Runner ────────────────────────────────
function Start-DevServer {
    param([int]$DevPort = $Port, [switch]$Open)

    Write-Header "Starting Vite Development Server" "Port: $DevPort | Host: 0.0.0.0"
    
    # Check port availability
    $portActive = $false
    try {
        $conns = Get-NetTCPConnection -LocalPort $DevPort -ErrorAction SilentlyContinue
        if ($conns) { $portActive = $true }
    } catch {}

    if ($portActive) {
        Write-Colored " ⚠ Port $DevPort appears to be in use. Vite will attempt to use next available port or attach." Yellow
    }

    $url = "http://localhost:$DevPort"
    Write-Colored " 🚀 Serving at: $url" Green
    Write-Colored " 💡 Press Ctrl+C to gracefully stop the dev server.`n" DarkGray

    if ($Open -or $OpenBrowser) {
        Start-Process $url
    }

    try {
        Push-Location $ProjectRoot
        $openArg = if ($Open -or $OpenBrowser) { '--open' } else { '' }
        & npx vite --port=$DevPort --host=0.0.0.0 $openArg
    }
    catch {
        Write-Colored " [Server stopped]" DarkGray
    }
    finally {
        Pop-Location
        Write-Colored " ✓ Dev server session ended." Green
    }
}

# ──────────────────────── Go WebAssembly Build ─────────────────────────────
function Build-GoWasm {
    Write-Header "Building Go Core WebAssembly Engine" "Target: public/autotrace_core.wasm"
    
    $goDir = Join-Path $ProjectRoot 'go_engine'
    $outWasm = Join-Path (Join-Path $ProjectRoot 'public') 'autotrace_core.wasm'

    $envVars = @{
        'GOOS'   = 'js'
        'GOARCH' = 'wasm'
    }

    $ok = Invoke-Step `
        -Title "Compile Go Core to WASM" `
        -Command "go build -ldflags='-s -w' -o `"$outWasm`" ." `
        -WorkDir $goDir `
        -Environment $envVars

    if ($ok -and (Test-Path $outWasm)) {
        $sizeBytes = (Get-Item $outWasm).Length
        $sizeMB = ($sizeBytes / 1MB).ToString('F2')
        Write-Colored " 🎉 WASM Engine Built Successfully: public/autotrace_core.wasm ($sizeMB MB)" Green
        return $true
    } else {
        Write-Colored " ✗ WASM Compilation failed." Red
        return $false
    }
}

# ──────────────────── Full 5-Stage Validation Pipeline ─────────────────────
function Invoke-FullPipeline {
    Write-Header "FULL PRODUCTION VALIDATION PIPELINE" "Executing 5 strict verification & build stages"

    $goDir = Join-Path $ProjectRoot 'go_engine'
    $wasmTarget = Join-Path (Join-Path $ProjectRoot 'public') 'autotrace_core.wasm'

    $stages = @(
        @{ N = 1; Title = 'Stage 1/5 — TypeScript Static Type & Lint Check'; Cmd = 'npx tsc --noEmit'; Dir = $ProjectRoot; Env = @{} }
        @{ N = 2; Title = 'Stage 2/5 — TypeScript Algorithmic Test Suite';   Cmd = 'npx tsx src/tests/runAllTests.ts'; Dir = $ProjectRoot; Env = @{} }
        @{ N = 3; Title = 'Stage 3/5 — Go Native Engine Verification';       Cmd = 'go run .'; Dir = $goDir; Env = @{} }
        @{ N = 4; Title = 'Stage 4/5 — Go Core WebAssembly Compilation';     Cmd = "go build -ldflags='-s -w' -o `"$wasmTarget`" ."; Dir = $goDir; Env = @{ 'GOOS' = 'js'; 'GOARCH' = 'wasm' } }
        @{ N = 5; Title = 'Stage 5/5 — Production Web Application Build';    Cmd = 'npx vite build'; Dir = $ProjectRoot; Env = @{} }
    )

    $totalStages = $stages.Count
    $passedStages = 0
    $stageResults = @()
    $pipelineTimer = [System.Diagnostics.Stopwatch]::StartNew()

    foreach ($stage in $stages) {
        $pct = [math]::Round((($stage.N - 1) / $totalStages) * 100)
        $filled = [math]::Round($pct / 5)
        $empty  = 20 - $filled
        $bar = ('█' * $filled) + ('░' * $empty)
        
        Write-Host ''
        Write-Colored "  [$bar] $pct%  $($stage.Title)" Magenta

        $stageTimer = [System.Diagnostics.Stopwatch]::StartNew()
        $ok = Invoke-Step -Title $stage.Title -Command $stage.Cmd -WorkDir $stage.Dir -Environment $stage.Env
        $stageTimer.Stop()
        
        $durationStr = $stageTimer.Elapsed.ToString('mm\:ss\.ff')
        if ($ok) {
            $passedStages++
            $stageResults += @{ Title = $stage.Title; Passed = $true; Duration = $durationStr }
        } else {
            $stageResults += @{ Title = $stage.Title; Passed = $false; Duration = $durationStr }
            break # Stop pipeline on first failure
        }
    }

    $pipelineTimer.Stop()
    $totalElapsed = $pipelineTimer.Elapsed.ToString('mm\:ss\.ff')

    Write-Host ''
    Write-Separator
    Write-Colored "  📊 PIPELINE SUMMARY ($passedStages/$totalStages stages completed in $totalElapsed)" White
    Write-Separator

    foreach ($res in $stageResults) {
        $icon = if ($res.Passed) { '✓ [PASS]' } else { '✗ [FAIL]' }
        $col = if ($res.Passed) { 'Green' } else { 'Red' }
        Write-Colored "    $icon $($res.Title.PadRight(50)) ($($res.Duration))" $col
    }

    Write-Separator
    if ($passedStages -eq $totalStages) {
        Write-Colored '  🎉 ALL 5 STAGES PASSED — 100% PRODUCTION READY!' Green
        return $true
    } else {
        Write-Colored "  ⚠ Pipeline aborted due to failure at stage $passedStages." Red
        return $false
    }
}

# ──────────────────────── System Doctor Diagnostics ────────────────────────
function Invoke-Doctor {
    Write-Header "SYSTEM DIAGNOSTICS & TOOLCHAIN AUDIT" "Inspecting Node, npm, Go, TypeScript, WASM & Ports"

    function Check-Tool {
        param([string]$Name, [string]$Command, [string]$Args = '--version')
        try {
            $ver = & $Command $Args 2>$null
            if ($LASTEXITCODE -eq 0 -and $ver) {
                $firstLine = ($ver -split "`n")[0].Trim()
                Write-Colored "  ✓ [FOUND] $Name : $firstLine" Green
                return $true
            }
        } catch {}
        Write-Colored "  ✗ [MISSING] $Name not detected in PATH" Red
        return $false
    }

    Write-Colored " Toolchain Check:" DarkCyan
    Check-Tool -Name "Node.js" -Command "node"
    Check-Tool -Name "npm" -Command "npm"
    Check-Tool -Name "Go Compiler" -Command "go" -Args "version"
    Check-Tool -Name "TypeScript Compiler" -Command "npx" -Args "tsc --version"
    Check-Tool -Name "TSX Runner" -Command "npx" -Args "tsx --version"
    Check-Tool -Name "Vite" -Command "npx" -Args "vite --version"

    Write-Host ''
    Write-Colored " Project Environment Check:" DarkCyan
    
    # Check node_modules
    $nodeModules = Join-Path $ProjectRoot 'node_modules'
    if (Test-Path $nodeModules) {
        Write-Colored "  ✓ [READY] node_modules exists" Green
    } else {
        Write-Colored "  ⚠ [WARN] node_modules missing. Run 'npm install'." Yellow
    }

    # Check Go engine
    $goMod = Join-Path (Join-Path $ProjectRoot 'go_engine') 'go.mod'
    if (Test-Path $goMod) {
        Write-Colored "  ✓ [READY] go_engine/go.mod exists" Green
    } else {
        Write-Colored "  ✗ [ERROR] go_engine/go.mod missing!" Red
    }

    # Check WASM target
    $wasmTarget = Join-Path (Join-Path $ProjectRoot 'public') 'autotrace_core.wasm'
    if (Test-Path $wasmTarget) {
        $sizeMB = ((Get-Item $wasmTarget).Length / 1MB).ToString('F2')
        Write-Colored "  ✓ [READY] public/autotrace_core.wasm exists ($sizeMB MB)" Green
    } else {
        Write-Colored "  ℹ [INFO] public/autotrace_core.wasm not compiled yet (run Action 'wasm' or 'pipeline')" DarkCyan
    }

    # Check port 3000
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            Write-Colored "  ⚠ [PORT] Port $Port is currently OCCUPIED (PID: $($conn.OwningProcess))" Yellow
        } else {
            Write-Colored "  ✓ [PORT] Port $Port is FREE and ready for Vite dev server" Green
        }
    } catch {
        Write-Colored "  ✓ [PORT] Port $Port check bypassed" DarkGray
    }

    Write-Host ''
    Write-Colored " Doctor audit completed." White
}

# ──────────────────────── Clean Artifacts ──────────────────────────────────
function Invoke-Clean {
    Write-Header "CLEANING BUILD ARTIFACTS & CACHES" "Resetting dist, wasm, and local compiler caches"

    $pathsToClean = @(
        (Join-Path $ProjectRoot 'dist'),
        (Join-Path $ProjectRoot 'node_modules\.vite'),
        (Join-Path (Join-Path $ProjectRoot 'public') 'autotrace_core.wasm')
    )

    foreach ($p in $pathsToClean) {
        if (Test-Path $p) {
            Write-Colored "  🧹 Removing: $p" Yellow
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $p
            Write-Colored "  ✓ Removed." Green
        } else {
            Write-Colored "  — Not present: $p" DarkGray
        }
    }

    Write-Colored "`n  ✨ Cleanup finished." Green
}

# ──────────────────────── Dispatcher Action ────────────────────────────────
function Execute-Action {
    param([string]$Act)

    $normalized = $Act.Trim().ToLower()
    switch ($normalized) {
        { $_ -in '1', 'dev', 'start', 'serve' } {
            Start-DevServer -DevPort $Port -Open:$OpenBrowser
        }
        { $_ -in '2', 'test', 'tests', 'ts-test' } {
            Invoke-Step -Title 'TypeScript Algorithmic Tests' -Command 'npx tsx src/tests/runAllTests.ts'
        }
        { $_ -in '3', 'go', 'go-test', 'engine' } {
            Invoke-Step -Title 'Go Engine Verification Tests' -Command 'go run .' -WorkDir (Join-Path $ProjectRoot 'go_engine')
        }
        { $_ -in '4', 'wasm', 'go-wasm', 'build-wasm' } {
            Build-GoWasm
        }
        { $_ -in '5', 'build', 'prod', 'bundle' } {
            Invoke-Step -Title 'Vite Production Build' -Command 'npx vite build'
        }
        { $_ -in '6', 'preview', 'view' } {
            Invoke-Step -Title 'Vite Production Preview' -Command 'npx vite preview'
        }
        { $_ -in '7', 'lint', 'typecheck', 'tsc' } {
            Invoke-Step -Title 'TypeScript Lint & Static Type Check' -Command 'npx tsc --noEmit'
        }
        { $_ -in '8', 'pipeline', 'all', 'ci' } {
            Invoke-FullPipeline
        }
        { $_ -in '9', 'bench', 'benchmark', 'perf' } {
            Invoke-Step -Title '10k Synthetic Circuit Benchmark Suite' -Command 'npx tsx src/tests/benchmark10k.ts'
        }
        { $_ -in '10', 'audit', 'deep-audit', 'latency' } {
            Invoke-Step -Title 'Deep Latency & P95/P99 Audit on 10k Graph' -Command 'npx tsx src/tests/deepAudit10k.ts'
        }
        { $_ -in '11', 'doctor', 'check', 'diag' } {
            Invoke-Doctor
        }
        { $_ -in '12', 'clean', 'reset' } {
            Invoke-Clean
        }
        { $_ -in '0', 'exit', 'quit', 'q' } {
            Write-Host ''
            Write-Colored '  👋 До встречи!' Magenta
            Write-Host ''
            exit 0
        }
        default {
            Write-Colored "  ⚠ Неизвестное действие: '$Act'. Введите номер 0–12 или название команды." Yellow
            return $false
        }
    }
    return $true
}

# ──────────────────────── Main Entry Point ─────────────────────────────────
if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full
    exit 0
}

# Direct CLI execution if Action parameter provided
if ($Action) {
    Show-Banner
    $ok = Execute-Action -Act $Action
    $exitCode = if ($ok -or $ok -eq $null) { 0 } else { 1 }
    exit $exitCode
}

# Interactive TUI Loop
Show-Banner
while ($true) {
    Show-Menu
    Write-Colored '  Выберите действие (0–12 или имя команды): ' Cyan -NoNewline
    $inputChoice = Read-Host

    if ([string]::IsNullOrWhiteSpace($inputChoice)) {
        continue
    }

    Execute-Action -Act $inputChoice

    if ($NonInteractive) {
        break
    }

    Write-Host ''
    Write-Colored '  Нажмите Enter чтобы вернуться в меню...' DarkGray -NoNewline
    Read-Host
}

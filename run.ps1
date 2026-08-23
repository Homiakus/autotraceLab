<#
.SYNOPSIS
    AutoTrace Lab — Interactive Progressive Launcher
.DESCRIPTION
    A single entry point for all project operations:
      1. Dev Server        — vite dev on port 3000
      2. TypeScript Tests  — tsx src/tests/runAllTests.ts
      3. Go Engine Tests   — go run ./go_engine
      4. Build Production  — vite build
      5. Lint / Type Check — tsc --noEmit
      6. Full Pipeline     — lint + TS tests + Go tests + build
      7. Go Benchmark      — quick A* routing benchmark
      0. Exit
.NOTES
    Run from project root:  pwsh ./run.ps1
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ─────────────────────────── colours & helpers ──────────────────────────────
function Write-Colored {
    param(
        [string]$Text,
        [ConsoleColor]$FG = 'White',
        [switch]$NoNewline
    )
    $prev = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $FG
    if ($NoNewline) { Write-Host $Text -NoNewline }
    else            { Write-Host $Text }
    $Host.UI.RawUI.ForegroundColor = $prev
}

function Write-Separator {
    Write-Colored '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' Cyan
}

function Write-SmallSep {
    Write-Colored '────────────────────────────────────────────────────────────────' DarkGray
}

# ─────────────────────────── progressive banner ─────────────────────────────
function Show-Banner {
    # Clear-Host omitted — works only in interactive terminals
    Write-Host "`n`n`n"
    $lines = @(
        ''
        '     █████╗ ██╗   ██╗████████╗ ██████╗ ████████╗██████╗  █████╗  ██████╗███████╗'
        '    ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝'
        '    ███████║██║   ██║   ██║   ██║   ██║   ██║   ██████╔╝███████║██║     █████╗  '
        '    ██╔══██║██║   ██║   ██║   ██║   ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝  '
        '    ██║  ██║╚██████╔╝   ██║   ╚██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗'
        '    ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝'
        ''
    )

    # Progressive animation: print each line with delay
    foreach ($line in $lines) {
        Write-Colored $line Magenta
        Start-Sleep -Milliseconds 35
    }
    Write-Colored '    ⚡ Block · Port · Placement · Routing · Cleanup · Validation' Yellow
    Write-Colored ''
}

# ──────────────────────────── progressive menu ──────────────────────────────
function Show-Menu {
    Write-Separator

    $items = @(
        @{ Key = '1'; Icon = '🚀'; Label = 'Dev Server';       Desc = 'vite dev :3000';           Color = 'Green' }
        @{ Key = '2'; Icon = '🧪'; Label = 'TypeScript Tests'; Desc = 'tsx runAllTests.ts';        Color = 'Cyan' }
        @{ Key = '3'; Icon = '🔧'; Label = 'Go Engine Tests';  Desc = 'go run ./go_engine';        Color = 'Blue' }
        @{ Key = '4'; Icon = '📦'; Label = 'Build Production'; Desc = 'vite build';                Color = 'Yellow' }
        @{ Key = '5'; Icon = '🔍'; Label = 'Lint / Types';     Desc = 'tsc --noEmit';              Color = 'DarkYellow' }
        @{ Key = '6'; Icon = '⚙️'; Label = 'Full Pipeline';    Desc = 'lint → tests → build';      Color = 'Magenta' }
        @{ Key = '7'; Icon = '⚡'; Label = 'Go Benchmark';     Desc = 'A* routing perf';           Color = 'DarkCyan' }
        @{ Key = '0'; Icon = '🚪'; Label = 'Exit';             Desc = '';                          Color = 'DarkGray' }
    )

    # Progressive reveal — each menu item slides in
    foreach ($item in $items) {
        $fg = [ConsoleColor]$item.Color
        Write-Colored '' -NoNewline
        Write-Colored "  $($item.Icon)  " $fg -NoNewline
        Write-Colored "[$($item.Key)]" White -NoNewline
        Write-Colored " $($item.Label)" $fg -NoNewline
        if ($item.Desc) {
            Write-Colored "  — $($item.Desc)" DarkGray
        } else {
            Write-Host ''
        }
        Start-Sleep -Milliseconds 50
    }

    Write-Separator
}

# ──────────────────── step runner with timing & status ──────────────────────
function Invoke-Step {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkDir = $ProjectRoot,
        [switch]$AllowFailure
    )

    Write-Host ''
    Write-SmallSep
    Write-Colored "▶ $Title" Yellow
    Write-SmallSep

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Push-Location $WorkDir
        Invoke-Expression $Command
        $exitCode = $LASTEXITCODE
        Pop-Location

        $sw.Stop()
        $elapsed = $sw.Elapsed.ToString('mm\:ss\.ff')

        if ($exitCode -and $exitCode -ne 0) {
            Write-Colored "✗ FAILED  ($elapsed)  exit code: $exitCode" Red
            return $false
        }
        Write-Colored "✓ DONE    ($elapsed)" Green
        return $true
    }
    catch {
        $sw.Stop()
        $elapsed = $sw.Elapsed.ToString('mm\:ss\.ff')
        if ($AllowFailure) {
            Write-Colored "⚠ WARNING ($elapsed): $_" Yellow
            return $true
        }
        Write-Colored "✗ ERROR   ($elapsed): $_" Red
        return $false
    }
}

# ──────────────────── full pipeline (progressive stages) ────────────────────
function Invoke-FullPipeline {
    Write-Host ''
    Write-Colored '  ╔══════════════════════════════════════════╗' Magenta
    Write-Colored '  ║       FULL PIPELINE — 4 STAGES          ║' Magenta
    Write-Colored '  ╚══════════════════════════════════════════╝' Magenta

    $goDir = Join-Path $ProjectRoot 'go_engine'
    $stages = @(
        @{ N = 1; Title = 'Stage 1/4 — Lint & Type Check';       Cmd = 'npx tsc --noEmit';              Dir = $ProjectRoot }
        @{ N = 2; Title = 'Stage 2/4 — TypeScript Test Suite';    Cmd = 'npx tsx src/tests/runAllTests.ts'; Dir = $ProjectRoot }
        @{ N = 3; Title = 'Stage 3/4 — Go Engine Verification';   Cmd = 'go run .';                      Dir = $goDir }
        @{ N = 4; Title = 'Stage 4/4 — Production Build';         Cmd = 'npx vite build';                Dir = $ProjectRoot }
    )

    $totalStages = $stages.Count
    $passedStages = 0
    $failedStages = @()

    foreach ($stage in $stages) {
        # Progress bar
        $pct = [math]::Round(($stage.N - 1) / $totalStages * 100)
        $filled = [math]::Round($pct / 5)
        $empty  = 20 - $filled
        $bar = ('█' * $filled) + ('░' * $empty)
        Write-Colored "  [$bar] $pct%  $($stage.Title)" Cyan

        $ok = Invoke-Step -Title $stage.Title -Command $stage.Cmd -WorkDir $stage.Dir
        if ($ok) {
            $passedStages++
        } else {
            $failedStages += $stage.Title
        }
    }

    # Final bar
    Write-Host ''
    Write-Colored "  [████████████████████] 100%  Pipeline complete" Green
    Write-Host ''
    Write-SmallSep

    if ($failedStages.Count -eq 0) {
        Write-Colored '  🎉 ALL 4 STAGES PASSED — Production-ready!' Green
    } else {
        Write-Colored "  ⚠ $($failedStages.Count)/$totalStages stages failed:" Red
        foreach ($f in $failedStages) {
            Write-Colored "    ✗ $f" Red
        }
    }
    Write-SmallSep
}

# ──────────────────────────── main loop ─────────────────────────────────────
Show-Banner
while ($true) {
    Show-Menu
    Write-Colored '  Выберите действие: ' Cyan -NoNewline
    $choice = Read-Host

    switch ($choice) {
        '1' {
            Write-Colored "`n  🚀 Starting Vite dev server on http://localhost:3000 ..." Green
            Write-Colored '  Press Ctrl+C to stop the server.' DarkGray
            Invoke-Step -Title 'Vite Dev Server' -Command 'npx vite --port=3000 --host=0.0.0.0'
        }
        '2' {
            Invoke-Step -Title 'TypeScript Algorithmic Tests' -Command 'npx tsx src/tests/runAllTests.ts'
        }
        '3' {
            Invoke-Step -Title 'Go Engine Verification Tests' -Command 'go run .' -WorkDir (Join-Path $ProjectRoot 'go_engine')
        }
        '4' {
            Invoke-Step -Title 'Vite Production Build' -Command 'npx vite build'
        }
        '5' {
            Invoke-Step -Title 'TypeScript Lint & Type Check' -Command 'npx tsc --noEmit'
        }
        '6' {
            Invoke-FullPipeline
        }
        '7' {
            Write-Colored "`n  ⚡ Running Go A* routing benchmark..." DarkCyan
            Invoke-Step -Title 'Go Micro-Benchmark' -Command 'go run .' -WorkDir (Join-Path $ProjectRoot 'go_engine')
        }
        '0' {
            Write-Host ''
            Write-Colored '  👋 До встречи!' Magenta
            Write-Host ''
            exit 0
        }
        default {
            Write-Colored '  ⚠ Неизвестная команда. Попробуйте 0–7.' Yellow
        }
    }

    Write-Host ''
    Write-Colored '  Нажмите Enter чтобы вернуться в меню...' DarkGray -NoNewline
    Read-Host
}

---
name: webapp-testing
description: "Local UI testing for DeKoi web and Tauri app behavior. Use when Xel asks for Tauri QA, in-app testing, native app QA, browser/UI verification, screenshots, console checks, Playwright checks, WebView2 inspection, responsive checks, visual proof, or validation of frontend behavior in this DeKoi workspace."
---

# Webapp Testing

## Overview

Use this skill for local UI verification in DeKoi. Browser checks are useful for
React rendering, layout, routing, console errors, and screenshots. Native Tauri
QA is required when the claim depends on the desktop shell, WebView2, Tauri
commands, filesystem dialogs, provider secrets, app-data storage, window
controls, or host capabilities.

This is a local DeKoi port of MuniMuni-authored in-app testing guidance. The
paths and commands below are adapted to this repo.

## DeKoi Defaults

- Workspace: `C:\DeKoi`.
- App title: `DeKoi`.
- Tauri window class on Windows: `Tauri Window`.
- Tauri config source of truth: `src-tauri/tauri.conf.json`.
- Current `devUrl`: `http://localhost:1420`; re-check the config before
  assuming it.
- Tauri dev frontend command: `pnpm dev:tauri-frontend`.
- Main native command: `pnpm tauri dev`.
- Stable QA launch command: `pnpm tauri dev --no-watch`.
- Browser smoke command: `pnpm test:ui` after browsers are installed.
- Browser smoke rerun without rebuild: `pnpm test:ui:run`.

Load `.github/agents/dekoi-workflow.md` and the relevant repo-local workflow,
architecture, mode, frontend, or bugfix skill before using UI results to drive
code changes.

## Decision Tree

1. If the user says `Tauri QA`, asks for an in-app/native app pass, or the
   changed behavior depends on Tauri, WebView2, host capabilities, file access,
   dialogs, persisted app data, provider secrets, or window controls:
   - Use the native Tauri path.
2. If an interactive native app is already running:
   - Reuse it. Do not start a second app just to satisfy the pass.
   - Say that the app was already running.
3. If no native app is running and hands-on QA is appropriate:
   - Start `pnpm tauri dev` from `C:\DeKoi`.
   - Prefer `pnpm tauri dev --no-watch` for a stable QA session that should not
     restart while files change.
   - Keep track of the process/session Codex started.
4. If browser-renderable proof is enough:
   - Use `pnpm test:ui`, the in-app Browser, or Playwright against the verified
     target.
5. If native Tauri proof is blocked:
   - Use browser/Vite proof only if it exercises the claim, and label the native
     gap explicitly.

## Native App Process Rules

Before starting anything, inspect what is already running:

```powershell
Get-Process node,cargo,dekoi -ErrorAction SilentlyContinue |
  Select-Object Id,ProcessName,Path,StartTime
```

- Do not stop, replace, or take ownership of Xel's running dev server, native
  app, or terminal.
- Stop only processes that Codex started for the current task.
- If another app instance is already bound to the Tauri dev port, use it or ask
  before disturbing it.
- For long-running Codex-owned QA launches, saving stdout/stderr under
  `scratch\` is useful, but logs are supporting evidence only.

## WebView2 Dev Debugging Hook

`pnpm tauri ...` runs through `scripts/run-tauri.mjs`. For native dev sessions,
set this environment variable when WebView2 console, network, DOM, or screenshot
inspection would help:

```powershell
$env:DEKOI_TAURI_AUTO_DEVTOOLS = "1"
pnpm tauri dev --no-watch
```

On Windows, the launcher adds:

```text
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
```

Check the active endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/list |
  Select-Object title,url,webSocketDebuggerUrl
```

Use Playwright CDP only as an inspection aid for the already-running native
WebView2:

```javascript
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const context = browser.contexts()[0];
const page = context.pages()[0];
```

Good uses:

- Console errors and warnings from the native WebView.
- Network failures, request payloads, and response statuses.
- DOM state, selectors, local storage, and screenshot capture from the native
  WebView.

Do not use the hook to claim file dialogs, filesystem permissions, provider
credentials, installer/update behavior, or OS integration worked. Those still
need native UI proof, targeted WebDriver specs, or a clearly stated manual gap.

## Interactive Windows Tauri QA

Prefer UIAutomation before coordinate clicking.

Find the native window:

```powershell
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$win = $root.FindFirst(
  [System.Windows.Automation.TreeScope]::Children,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    "DeKoi"
  ))
)
$rect = $win.Current.BoundingRectangle
```

Capture from the UIA window rectangle into `scratch/` before visual assertions:

```powershell
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force scratch | Out-Null
$dst = Join-Path (Get-Location) "scratch\tauri-window.png"
$bmp = New-Object System.Drawing.Bitmap([int]$rect.Width, [int]$rect.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
try { $g.CopyFromScreen([int]$rect.X, [int]$rect.Y, 0, 0, $bmp.Size) } finally { $g.Dispose() }
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
```

Useful UIA evidence:

- visible status text
- button enabled/disabled state
- selected labels, panel titles, and dialog titles
- whether an offscreen section can scroll into view
- stable screenshot from the actual Tauri window

Use coordinate fallback only when UIA patterns are missing. Re-read the window
rectangle immediately before coordinate actions and prefer relative coordinates
from the current window top-left.

## Browser And Playwright Use

Use Browser/Playwright for:

- static docs or static HTML
- browser-renderable React layout checks
- console/network checks in Vite or preview
- responsive screenshots
- debugging selectors before native proof
- CDP inspection of native WebView2 through `127.0.0.1:9222`

For DeKoi, browser-only checks against Vite or preview are partial proof for
native behavior. Label them:

```text
Browser/Vite check only; native Tauri behavior still unverified.
```

Keep generated Playwright scripts temporary unless Xel asks for a committed
test. Use `scripts/with_server.py` when you need a short-lived local server
around a temporary proof command.

## Proof Shape

Report proof without overstating it:

```text
UI QA:
- Path: native Tauri / Browser / Playwright / WebView2 CDP
- Target: <window title, URL, route, or component>
- Workflow exercised: <exact panel/modal/actions>
- Observed: <visible state, UIA state, screenshot artifact, console/log signal>
- Verification gap: <native/provider/file picker/viewport/platform/data not covered>
- Cleanup: <left user app running / stopped Codex-owned process>
```

For code-change final handoff, still include behavior changed, files/modules
touched, impact/dependent areas reviewed, verification, and remaining risk.

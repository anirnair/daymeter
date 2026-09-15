# Foreground look → Daymeter ingest. Schedule every 1 minute at logon (hidden).
# Remembers the previous look so this POST can carry an honest duration.
param(
  [string]$Url = $(if ($env:DAYMETER_INGEST_URL) { $env:DAYMETER_INGEST_URL } else { "http://127.0.0.1:5173/api/ingest" }),
  [string]$Token = $env:DAYMETER_INGEST_TOKEN,
  [string]$Device = $(if ($env:DAYMETER_DEVICE) { $env:DAYMETER_DEVICE } else { "MSI" }),
  [int]$IdleCapSec = $(if ($env:DAYMETER_IDLE_CAP_SEC) { [int]$env:DAYMETER_IDLE_CAP_SEC } else { 180 })
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DaymeterWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  public static uint IdleMs() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return 0;
    return (uint)Environment.TickCount - info.dwTime;
  }
}
"@

$hwnd = [DaymeterWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[void][DaymeterWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$title = $sb.ToString()
$procId = 0
[void][DaymeterWin]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
$app = if ($proc) { $proc.ProcessName } else { "unknown" }
$bundle = $null
if ($proc -and $proc.Path) { $bundle = $proc.Path }
$idleSec = [math]::Floor([DaymeterWin]::IdleMs() / 1000)

$offset = (Get-TimeZone).BaseUtcOffset
$sign = if ($offset.TotalMinutes -ge 0) { "+" } else { "-" }
$ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") + $sign + $offset.ToString("hhmm")

$stateDir = Join-Path $env:LOCALAPPDATA "daymeter"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$stateFile = Join-Path $stateDir "last-look.json"

$urlHint = $null
$lower = $app.ToLowerInvariant()
if ($lower -match "chrome|msedge|brave|firefox") {
  try {
    $proc2 = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    if ($proc2 -and $proc2.CommandLine -match "https?://\S+") {
      $urlHint = $Matches[0].Trim('"')
    }
  } catch {}
}

$bodyObj = @{
  ts     = $ts
  device = $Device
  app    = $app
}
if ($title) { $bodyObj.title = $title }
if ($urlHint) { $bodyObj.url = $urlHint }
if ($bundle) { $bodyObj.bundle = $bundle }

$rows = @()
if (Test-Path $stateFile) {
  try {
    $prev = Get-Content -Raw $stateFile | ConvertFrom-Json
    if ($prev.ts -and $prev.app -and -not $prev.idle) {
      $prevDt = [datetime]::Parse($prev.ts)
      $gap = [math]::Max(0, ((Get-Date) - $prevDt).TotalSeconds)
      $seconds = [math]::Min($gap, $IdleCapSec)
      if ($idleSec -ge $IdleCapSec) { $seconds = 0 }
      if ($seconds -ge 1) {
        $closed = @{
          ts     = $prev.ts
          device = $prev.device
          app    = $prev.app
          seconds = [math]::Round($seconds, 3)
          end    = $ts
        }
        if ($prev.title) { $closed.title = $prev.title }
        if ($prev.url) { $closed.url = $prev.url }
        if ($prev.bundle) { $closed.bundle = $prev.bundle }
        $rows += $closed
      }
    }
  } catch {}
}

if ($idleSec -lt $IdleCapSec) {
  $rows += $bodyObj
  ($bodyObj | ConvertTo-Json -Compress) | Set-Content -Path $stateFile -Encoding UTF8
} else {
  (@{ ts = $ts; device = $Device; app = $app; idle = $true } | ConvertTo-Json -Compress) | Set-Content -Path $stateFile -Encoding UTF8
}

if ($rows.Count -eq 0) {
  Write-Output "idle ${idleSec}s — not posting"
  return
}

$payload = if ($rows.Count -eq 1) { $rows[0] | ConvertTo-Json -Compress } else { @{ device = $Device; samples = $rows } | ConvertTo-Json -Compress -Depth 6 }

$headers = @{ "Content-Type" = "application/json" }
if ($Token) { $headers["x-daymeter-token"] = $Token }

Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $payload

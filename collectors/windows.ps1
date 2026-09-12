# Foreground look → Daymeter ingest. Schedule every 1 minute at logon (hidden).
param(
  [string]$Url = $(if ($env:DAYMETER_INGEST_URL) { $env:DAYMETER_INGEST_URL } else { "http://127.0.0.1:5173/api/ingest" }),
  [string]$Token = $env:DAYMETER_INGEST_TOKEN,
  [string]$Device = $(if ($env:DAYMETER_DEVICE) { $env:DAYMETER_DEVICE } else { "MSI" })
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DaymeterWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@

$hwnd = [DaymeterWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][DaymeterWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$title = $sb.ToString()
$pid = 0
[void][DaymeterWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$app = if ($proc) { $proc.ProcessName } else { "unknown" }

$offset = (Get-TimeZone).BaseUtcOffset
$sign = if ($offset.TotalMinutes -ge 0) { "+" } else { "-" }
$ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") + $sign + $offset.ToString("hhmm")

$body = @{
  ts     = $ts
  device = $Device
  app    = $app
}
if ($title) { $body.title = $title }

$headers = @{ "Content-Type" = "application/json" }
if ($Token) { $headers["x-daymeter-token"] = $Token }

Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body ($body | ConvertTo-Json -Compress)

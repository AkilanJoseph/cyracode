param(
    [string]$BindHost = "127.0.0.1",
    [int]$Port = 8000,
    [int]$TimeoutSeconds = 20
)

$py = "C:\Projects\CyraCodeNew\cyracode\backend\.venv\Scripts\python.exe"
$out = "C:\Users\Akilan\AppData\Local\Temp\opencode\cyracode-backend.out.log"
$err = "C:\Users\Akilan\AppData\Local\Temp\opencode\cyracode-backend.err.log"
$pidFile = "C:\Users\Akilan\AppData\Local\Temp\opencode\cyracode-backend.pid"

$p = Start-Process -FilePath $py -ArgumentList "-m", "uvicorn", "app.main:app", "--host", $BindHost, "--port", "$Port" -WorkingDirectory "C:\Projects\CyraCodeNew\cyracode\backend" -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
$p.Id | Set-Content $pidFile

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ready = $false
$uri = "http://${BindHost}:${Port}/health"
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds -and -not $ready) {
    if ($p.HasExited) { break }
    try { Invoke-RestMethod -Uri $uri -TimeoutSec 2 | Out-Null; $ready = $true } catch { Start-Sleep -Milliseconds 300 }
}

Write-Host "Started in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s - PID: $($p.Id)" -ForegroundColor Green
if ($p.HasExited) { Write-Host "EXITED with code $($p.ExitCode)" -ForegroundColor Red } elseif ($ready) { Write-Host "RUNNING" -ForegroundColor Green } else { Write-Host "TIMEOUT" -ForegroundColor Red }
param(
    [Parameter(Mandatory)] [string] $DaxFile,
    [Parameter(Mandatory)] [int] $Port,
    [string] $OutCsv,
    [string] $PbiBin = "$env:ProgramFiles\Microsoft Power BI Desktop\bin"
)
$ErrorActionPreference = "Stop"
# Read-only: runs a DAX query file against a local Desktop AS instance; per result set: rows, not-TRUE count, elapsed.
Add-Type -Path (Join-Path $PbiBin "Microsoft.PowerBI.AdomdClient.dll")
$query = [System.IO.File]::ReadAllText($DaxFile, [System.Text.Encoding]::UTF8)
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection("Data Source=localhost:$Port")
$conn.Open()
$cmd = $conn.CreateCommand(); $cmd.CommandText = $query; $cmd.CommandTimeout = 1800
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$reader = $cmd.ExecuteReader()
$set = 0; $last = 0.0
$rows = New-Object System.Collections.Generic.List[string]
$failTotal = 0; $rowTotal = 0; $noPass = 0
do {
    $set++
    $cols = @(); for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
    $passIdx = [array]::IndexOf(($cols | ForEach-Object { $_ -replace '^.*\[(.*)\]$', '$1' }), '_pass')
    if ($passIdx -lt 0) { $noPass++ }
    $n = 0; $fail = 0
    while ($reader.Read()) {
        $n++
        $vals = @(); for ($i = 0; $i -lt $reader.FieldCount; $i++) { $vals += [string]$reader.GetValue($i) }
        $line = "set$set`t" + ($vals -join "`t"); $rows.Add($line)
        if ($passIdx -ge 0 -and $vals[$passIdx] -ne 'True') { $fail++; if ($fail -le 10) { Write-Output "FAIL $line" } }
    }
    $now = $sw.Elapsed.TotalSeconds
    $rowTotal += $n; $failTotal += $fail
    Write-Output ("set {0}: {1} rows, {2} not TRUE, _pass col {3}, {4:n1} s (cum {5:n1} s); first cols: {6}" -f $set, $n, $fail, ($passIdx -ge 0), ($now - $last), $now, (($cols | Select-Object -First 3) -join ', '))
    $last = $now
} while ($reader.NextResult())
$reader.Close(); $conn.Close()
Write-Output ("TOTAL: {0} sets, {1} rows, {2} not TRUE, {3} sets without _pass, {4:n1} s" -f $set, $rowTotal, $failTotal, $noPass, $sw.Elapsed.TotalSeconds)
if ($OutCsv) { [System.IO.File]::WriteAllLines($OutCsv, $rows, (New-Object System.Text.UTF8Encoding($false))) }

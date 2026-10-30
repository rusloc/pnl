param(
    [Parameter(Mandatory)] [int] $Port,
    [string] $Pattern = ".",
    [string] $TestFile = (Join-Path $PSScriptRoot "..\..\tests\control-totals.dax"),
    [string] $OutDir = (Join-Path $env:TEMP "nordmark-tests"),
    [string] $PbiBin = "$env:ProgramFiles\Microsoft Power BI Desktop\bin"
)
# Read-only: split tests/control-totals.dax at '// ==== BLOCK' and run the blocks whose name matches -Pattern (regex, e.g.
# "T-N[2-9]|T-N1-(ALL-P26|NL-P25)") one at a time against a local Desktop instance; every row must return _pass = TRUE.
$ErrorActionPreference = "Stop"
$blocks = Join-Path $OutDir "blocks"
python (Join-Path $PSScriptRoot "split_blocks.py") $TestFile $blocks | Out-Null
$fail = 0; $rows = 0
foreach ($f in Get-ChildItem $blocks -Filter *.dax | Sort-Object Name | Where-Object { $_.BaseName -match $Pattern }) {
    $o = & (Join-Path $PSScriptRoot "run-dax.ps1") -DaxFile $f.FullName -Port $Port -OutCsv (Join-Path $OutDir "$($f.BaseName).csv") -PbiBin $PbiBin
    $t = $o | Where-Object { $_ -like "TOTAL:*" }
    "{0} | {1}" -f $f.BaseName, $t
    $o | Where-Object { $_ -like "FAIL*" } | Select-Object -First 5
    if ($t -match "(\d+) rows, (\d+) not TRUE") { $rows += [int]$Matches[1]; $fail += [int]$Matches[2] }
}
"ALL: $rows rows, $fail not TRUE"

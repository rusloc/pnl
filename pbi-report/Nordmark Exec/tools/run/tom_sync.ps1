param([int]$Port, [string]$SpecFile, [string]$PbiBin = "$env:ProgramFiles\Microsoft Power BI Desktop\bin")
# Local scratch instance only (never the copy the USER works in): sync _measures of a Desktop model to the generator output
# (spec from gen/export_sync.py). In-memory only; nothing is saved. Note: after a push, cold timings on that instance read high.
$bin = $PbiBin
foreach ($r in @("$bin\Microsoft.PowerBI.Tabular.dll", "$bin\Microsoft.PowerBI.Tabular.Json.dll", "$bin\Microsoft.PowerBI.Amo.Core.dll", "$bin\Microsoft.PowerBI.Amo.dll")) { [void][Reflection.Assembly]::LoadFrom($r) }
$spec = Get-Content $SpecFile -Raw -Encoding UTF8 | ConvertFrom-Json
$s = New-Object Microsoft.AnalysisServices.Tabular.Server; $s.Connect("Data Source=localhost:$Port")
$model = $s.Databases[0].Model
$t = $model.Tables['_measures']
$names = @{}; $add = 0; $upd = 0; $del = 0
foreach ($x in $spec.measures) {
  $names[$x.name] = 1
  $m = $t.Measures.Find($x.name)
  if (-not $m) { $m = New-Object Microsoft.AnalysisServices.Tabular.Measure; $m.Name = $x.name; $t.Measures.Add($m); $add++ }
  elseif ($m.Expression -ne $x.expr) { $upd++ }
  $m.Expression = $x.expr; $m.IsHidden = [bool]$x.hidden; $m.DisplayFolder = $x.folder
  if ($x.fmt) { $m.FormatString = $x.fmt }
  if ($x.cat) { $m.DataCategory = $x.cat }
}
foreach ($m in @($t.Measures)) { if (-not $names.ContainsKey($m.Name)) { [void]$t.Measures.Remove($m); $del++ } }
$model.SaveChanges() | Out-Null
$s.Disconnect()
"measures: +$add ~$upd -$del"

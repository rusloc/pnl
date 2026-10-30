param([int]$Port, [string]$OutCsv, [int]$Repeat = 3, [string]$Only = "", [string]$States = "", [string]$DefineFile = "", [string]$Measures = "",
      [string]$PbiBin = "$env:ProgramFiles\Microsoft Power BI Desktop\bin")
# Local scratch instance only. Cold timing: XMLA ClearCache before every query, one query per visual measure (header, status line,
# 12 cards, 12 i pop-ups), picker state passed as slicer filters; -States / -Only / -Measures narrow the run, -DefineFile prepends a DEFINE.
$ErrorActionPreference = "Stop"
Add-Type -Path (Join-Path $PbiBin "Microsoft.PowerBI.AdomdClient.dll")
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection("Data Source=localhost:$Port")
$conn.Open()
$db = $conn.GetSchemaDataSet("DBSCHEMA_CATALOGS", $null).Tables[0].Rows[0]["CATALOG_NAME"]
$define = if ($DefineFile) { [IO.File]::ReadAllText($DefineFile) + "`n" } else { "" }
$K = "NET_SALES","TOTAL_MARGIN","WEEKS_OF_COVER","MARKDOWN","AVAILABILITY","EBITDA","LFL_GROWTH","FRONT_GM","SELL_THROUGH","GMROI","SUPPLIER_OTIF","CHANNEL_MIX"
$ms = @("Header SVG", "Status Line SVG") + ($K | ForEach-Object { "Card SVG $_" }) + ($K | ForEach-Object { "Info SVG $_" })
if ($Measures) { $ms = $Measures -split ";" }
if ($Only) { $ms = $ms | Where-Object { $_ -match $Only } }
$st = [ordered]@{
  "W43 BUD ALL"  = 'TREATAS ( { "W" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "W43" }, dim_item[label] ), TREATAS ( { "BUD" }, param_comparator[comparator_code] ), TREATAS ( { "ALL" }, param_region[scope_code] )'
  "P10 LY ALL"   = 'TREATAS ( { "P" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "P10" }, dim_item[label] ), TREATAS ( { "LY" }, param_comparator[comparator_code] ), TREATAS ( { "ALL" }, param_region[scope_code] )'
  "Q4 LW NL"     = 'TREATAS ( { "Q" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "Q4 · to date" }, dim_item[label_wide] ), TREATAS ( { "LW" }, param_comparator[comparator_code] ), TREATAS ( { "NL" }, param_region[scope_code] )'
  "FY26 BUD ALL" = 'TREATAS ( { "FY" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "FY2026 · to date" }, dim_item[label_wide] ), TREATAS ( { "BUD" }, param_comparator[comparator_code] ), TREATAS ( { "ALL" }, param_region[scope_code] )'
  "C W43 BUD ALL#ELEC" = 'TREATAS ( { "W" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "W43" }, dim_item[label] ), TREATAS ( { "BUD" }, param_comparator[comparator_code] ), TREATAS ( { "ALL" }, param_region[scope_code] ), TREATAS ( { "Electronics" }, dim_category[category_name] )'
  "C P10 LW NL#ELEC+TOYS" = 'TREATAS ( { "P" }, param_granularity[granularity_code] ), TREATAS ( { "FY2026" }, dim_item[fy_label] ), TREATAS ( { "P10" }, dim_item[label] ), TREATAS ( { "LW" }, param_comparator[comparator_code] ), TREATAS ( { "NL" }, param_region[scope_code] ), TREATAS ( { "Electronics", "Toys & leisure" }, dim_category[category_name] )'
}
$out = New-Object System.Collections.Generic.List[string]
$out.Add("state`tmeasure`trun`tms`tlen")
# interleaved: measure -> run -> state, so a drift in machine load hits every state alike
foreach ($m in $ms) {
  for ($r = 1; $r -le $Repeat; $r++) {
    foreach ($sn in $st.Keys) {
      if ($States -and ($sn -notmatch $States)) { continue }
      $c = $conn.CreateCommand(); $c.CommandTimeout = 900
      $c.CommandText = "<ClearCache xmlns=`"http://schemas.microsoft.com/analysisservices/2003/engine`"><Object><DatabaseID>$db</DatabaseID></Object></ClearCache>"; [void]$c.ExecuteNonQuery()
      $q = $conn.CreateCommand(); $q.CommandTimeout = 900
      $q.CommandText = $define + "EVALUATE CALCULATETABLE ( ROW ( `"x`", LEN ( [$m] ) ), $($st[$sn]) )"
      $sw = [Diagnostics.Stopwatch]::StartNew()
      $rd = $q.ExecuteReader(); [void]$rd.Read(); $len = $rd.GetValue(0); $rd.Close()
      $t = [int]$sw.Elapsed.TotalMilliseconds
      $out.Add("$sn`t$m`t$r`t$t`t$len")
      Write-Output "$sn | $m | $r | $t ms | len $len"
    }
  }
}
$conn.Close()
[IO.File]::WriteAllLines($OutCsv, $out, (New-Object Text.UTF8Encoding($false)))

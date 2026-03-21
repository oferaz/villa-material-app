param(
  [string]$InputSqlPath = "",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptRoot)

if ([string]::IsNullOrWhiteSpace($InputSqlPath)) {
  $InputSqlPath = Join-Path $RepoRoot "db\manual\20260316_import_srithanu_customer_project.sql"
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $RepoRoot "tmp"
}

function Normalize-Whitespace {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  return ([regex]::Replace($Text, "\s+", " ")).Trim()
}

function Strip-Html {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  return Normalize-Whitespace ([regex]::Replace($Text, "<[^>]*>", " "))
}

function Parse-NumberLike {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  $cleaned = ($Text -replace "[^\d\.,-]", "").Trim()
  if (-not $cleaned) { return $null }
  if ($cleaned.Contains(",") -and -not $cleaned.Contains(".")) {
    $normalized = $cleaned -replace ",", "."
  } else {
    $normalized = $cleaned -replace ",", ""
  }
  $parsed = 0.0
  if ([double]::TryParse($normalized, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
    if ($parsed -gt 0) { return [math]::Round($parsed, 0) }
  }
  return $null
}

function Get-MetaContent {
  param(
    [string]$Html,
    [string[]]$Keys
  )
  if ([string]::IsNullOrWhiteSpace($Html)) { return $null }
  foreach ($key in $Keys) {
    $escaped = [regex]::Escape($key)
    $patterns = @(
      "(?is)<meta\s+[^>]*(?:property|name|itemprop)\s*=\s*['""]$escaped['""][^>]*content\s*=\s*['""]([^'""]+)['""][^>]*>",
      "(?is)<meta\s+[^>]*content\s*=\s*['""]([^'""]+)['""][^>]*(?:property|name|itemprop)\s*=\s*['""]$escaped['""][^>]*>"
    )
    foreach ($pattern in $patterns) {
      $match = [regex]::Match($Html, $pattern)
      if ($match.Success) {
        $value = Normalize-Whitespace $match.Groups[1].Value
        if ($value) { return $value }
      }
    }
  }
  return $null
}

function Resolve-AbsoluteUrl {
  param(
    [string]$BaseUrl,
    [string]$Candidate
  )
  if ([string]::IsNullOrWhiteSpace($Candidate)) { return $null }
  try {
    $base = [System.Uri]$BaseUrl
    $absolute = [System.Uri]::new($base, $Candidate)
    return $absolute.AbsoluteUri
  } catch {
    return $null
  }
}

function Get-Title {
  param([string]$Html)
  $meta = Get-MetaContent -Html $Html -Keys @("og:title", "twitter:title")
  if ($meta) { return $meta }
  $match = [regex]::Match($Html, "(?is)<title[^>]*>(.*?)</title>")
  if ($match.Success) {
    $title = Strip-Html $match.Groups[1].Value
    if ($title) { return $title }
  }
  return $null
}

function Get-PriceFromText {
  param([string]$Html)
  $text = Strip-Html $Html
  $patterns = @(
    '\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
    'USD\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
    'THB\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
    '฿\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)'
  )
  foreach ($pattern in $patterns) {
    $match = [regex]::Match($text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $parsed = Parse-NumberLike $match.Groups[1].Value
      if ($parsed -ne $null) { return $parsed }
    }
  }
  return $null
}

function Get-SupplierFromUrl {
  param([string]$Url)
  try {
    $host = ([System.Uri]$Url).Host.ToLower()
    if ($host.StartsWith("www.")) { $host = $host.Substring(4) }
    $first = ($host -split "\.")[0]
    if (-not $first) { return $null }
    return (($first -split "-") | ForEach-Object {
      if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } else { $_ }
    }) -join " "
  } catch {
    return $null
  }
}

function Parse-ImportRowsFromSql {
  param([string]$SqlText)

  $marker = "insert into tmp_import_rows"
  $markerIndex = $SqlText.ToLower().IndexOf($marker)
  if ($markerIndex -lt 0) { throw "Could not find tmp_import_rows insert block." }

  $valuesIndex = $SqlText.ToLower().IndexOf("values", $markerIndex)
  if ($valuesIndex -lt 0) { throw "Could not find VALUES in tmp_import_rows insert block." }

  $endIndex = $SqlText.IndexOf(";", $valuesIndex)
  if ($endIndex -lt 0) { throw "Could not find end of tmp_import_rows insert block." }

  $valuesBlock = $SqlText.Substring($valuesIndex + 6, $endIndex - ($valuesIndex + 6))
  $rows = New-Object System.Collections.Generic.List[object]

  $inString = $false
  $depth = 0
  $buffer = New-Object System.Text.StringBuilder
  $tupleBuffers = New-Object System.Collections.Generic.List[string]

  for ($i = 0; $i -lt $valuesBlock.Length; $i++) {
    $ch = $valuesBlock[$i]
    if ($inString) {
      [void]$buffer.Append($ch)
      if ($ch -eq "'") {
        if ($i + 1 -lt $valuesBlock.Length -and $valuesBlock[$i + 1] -eq "'") {
          [void]$buffer.Append("'")
          $i++
        } else {
          $inString = $false
        }
      }
      continue
    }

    if ($ch -eq "'") {
      $inString = $true
      [void]$buffer.Append($ch)
      continue
    }

    if ($ch -eq "(") {
      $depth++
      if ($depth -eq 1) {
        $buffer.Clear() | Out-Null
        continue
      }
    }

    if ($ch -eq ")") {
      $depth--
      if ($depth -eq 0) {
        $tupleBuffers.Add($buffer.ToString())
        $buffer.Clear() | Out-Null
        continue
      }
    }

    if ($depth -ge 1) {
      [void]$buffer.Append($ch)
    }
  }

  foreach ($tuple in $tupleBuffers) {
    $tokens = New-Object System.Collections.Generic.List[string]
    $token = New-Object System.Text.StringBuilder
    $tupleInString = $false

    for ($i = 0; $i -lt $tuple.Length; $i++) {
      $ch = $tuple[$i]
      if ($tupleInString) {
        [void]$token.Append($ch)
        if ($ch -eq "'") {
          if ($i + 1 -lt $tuple.Length -and $tuple[$i + 1] -eq "'") {
            [void]$token.Append("'")
            $i++
          } else {
            $tupleInString = $false
          }
        }
        continue
      }

      if ($ch -eq "'") {
        $tupleInString = $true
        [void]$token.Append($ch)
        continue
      }

      if ($ch -eq ",") {
        $tokens.Add($token.ToString().Trim())
        $token.Clear() | Out-Null
        continue
      }

      [void]$token.Append($ch)
    }

    if ($token.ToString().Trim()) {
      $tokens.Add($token.ToString().Trim())
    }

    if ($tokens.Count -ne 20) {
      throw "Unexpected tuple column count: $($tokens.Count)"
    }

    $row = [ordered]@{
      source_seq = [int]$tokens[0]
      house_name = $tokens[2]
      room_name_en = $tokens[4]
      item_name_en = $tokens[7]
      source_url = $tokens[15]
    }

    foreach ($key in @("house_name", "room_name_en", "item_name_en", "source_url")) {
      $v = [string]$row[$key]
      if ($v.StartsWith("'") -and $v.EndsWith("'")) {
        $v = $v.Substring(1, $v.Length - 2).Replace("''", "'")
      } elseif ($v -match "^(?i)null$") {
        $v = ""
      }
      $row[$key] = $v
    }

    $rows.Add([pscustomobject]$row)
  }

  return $rows
}

function Fetch-LinkMetadata {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 10 -TimeoutSec 30
    $finalUrl = $response.BaseResponse.ResponseUri.AbsoluteUri
    $html = [string]$response.Content
    if ($html.Length -gt 2097152) { $html = $html.Substring(0, 2097152) }

    $name = Get-Title $html
    $imageCandidate = Get-MetaContent -Html $html -Keys @("og:image", "og:image:url", "twitter:image", "twitter:image:src", "image")
    $imageUrl = Resolve-AbsoluteUrl -BaseUrl $finalUrl -Candidate $imageCandidate
    $metaPrice = Get-MetaContent -Html $html -Keys @("product:price:amount", "og:price:amount", "price", "twitter:data1")
    $price = Parse-NumberLike $metaPrice
    if ($price -eq $null) {
      $price = Get-PriceFromText $html
    }

    return [pscustomobject]@{
      url = $Url
      ok = $true
      status = [int]$response.StatusCode
      finalUrl = $finalUrl
      name = $name
      supplier = Get-SupplierFromUrl $finalUrl
      price = $price
      imageUrl = $imageUrl
      warning = $(if ($price -eq $null) { "Could not extract price from page." } else { $null })
      error = $null
    }
  } catch {
    return [pscustomobject]@{
      url = $Url
      ok = $false
      status = $null
      finalUrl = $Url
      name = $null
      supplier = $null
      price = $null
      imageUrl = $null
      warning = $null
      error = $_.Exception.Message
    }
  }
}

if (-not (Test-Path -LiteralPath $InputSqlPath)) {
  throw "Input SQL file not found: $InputSqlPath"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -Path $OutputDir -ItemType Directory | Out-Null
}

$sqlText = Get-Content -LiteralPath $InputSqlPath -Raw -Encoding UTF8
$rows = Parse-ImportRowsFromSql -SqlText $sqlText
$linkedRows = $rows | Where-Object { $_.source_url -match '^https?://' }
$uniqueUrls = $linkedRows | Select-Object -ExpandProperty source_url -Unique

Write-Output "Parsed $($rows.Count) rows."
Write-Output "Found $($linkedRows.Count) linked rows ($($uniqueUrls.Count) unique URLs)."

$urlResults = @{}
for ($i = 0; $i -lt $uniqueUrls.Count; $i++) {
  $url = $uniqueUrls[$i]
  Write-Output "[$($i+1)/$($uniqueUrls.Count)] Fetching $url"
  $urlResults[$url] = Fetch-LinkMetadata -Url $url
}

$expanded = foreach ($row in $linkedRows) {
  $f = $urlResults[$row.source_url]
  [pscustomobject]@{
    source_seq = $row.source_seq
    house_name = $row.house_name
    room_name_en = $row.room_name_en
    item_name_en = $row.item_name_en
    source_url = $row.source_url
    final_url = $f.finalUrl
    ok = $f.ok
    http_status = $f.status
    fetched_name = $f.name
    fetched_supplier = $f.supplier
    fetched_price = $f.price
    fetched_image_url = $f.imageUrl
    warning = $f.warning
    error = $f.error
  }
}

$successCount = ($urlResults.Values | Where-Object { $_.ok }).Count
$withPriceCount = ($urlResults.Values | Where-Object { $_.ok -and $_.price -ne $null }).Count
$withImageCount = ($urlResults.Values | Where-Object { $_.ok -and -not [string]::IsNullOrWhiteSpace($_.imageUrl) }).Count

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH-mm-ss-fffK").Replace(":", "-")
$jsonPath = Join-Path $OutputDir "import_link_metadata_powershell_$timestamp.json"
$csvPath = Join-Path $OutputDir "import_link_metadata_powershell_$timestamp.csv"

$payload = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  input_sql = $InputSqlPath
  totals = [ordered]@{
    parsed_rows = $rows.Count
    linked_rows = $linkedRows.Count
    unique_urls = $uniqueUrls.Count
    fetch_success = $successCount
    with_price = $withPriceCount
    with_image = $withImageCount
  }
  url_results = $urlResults.Values
  expanded_rows = $expanded
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$expanded | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

Write-Output ""
Write-Output "Done."
Write-Output "JSON: $jsonPath"
Write-Output "CSV:  $csvPath"
Write-Output "Summary: success $successCount/$($uniqueUrls.Count), with price $withPriceCount, with image $withImageCount"



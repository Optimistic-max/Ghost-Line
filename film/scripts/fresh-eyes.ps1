# Contact sheets of every 10th frame (joined halves), 12 per sheet (4 x 3), for the first-time-viewer pass.
# -> qa\fresh-eyes\sheet-NN.jpg (frame numbers in the file name order: row by row)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$out = "qa\fresh-eyes"; New-Item -ItemType Directory -Force $out | Out-Null
Remove-Item "$out\*.jpg" -EA SilentlyContinue
$frames = 0..902 | Where-Object { $_ % 10 -eq 0 }
$sheet = 0
for ($i = 0; $i -lt $frames.Count; $i += 12) {
  $chunk = $frames[$i..([Math]::Min($i + 11, $frames.Count - 1))]
  $args = @(); $fc = ""
  $k = 0
  foreach ($n in $chunk) {
    $nm = '{0:D5}.jpg' -f $n
    $args += '-i'; $args += "frames\L\$nm"; $args += '-i'; $args += "frames\R\$nm"
    $fc += "[$(2*$k)][$(2*$k+1)]hstack,scale=480:270[v$k];"
    $k++
  }
  while ($k % 4 -ne 0 -or $k -lt 12) { $fc += "color=c=0x17121F:s=480x270:d=1[v$k];"; $k++ ; if ($k -ge 12) { break } }
  $rows = @()
  for ($r = 0; $r -lt 3; $r++) { $fc += "[v$($r*4)][v$($r*4+1)][v$($r*4+2)][v$($r*4+3)]hstack=4[r$r];"; $rows += "[r$r]" }
  $fc += ($rows -join '') + "vstack=3"
  $sheet++
  ffmpeg -y -loglevel error @args -filter_complex $fc -frames:v 1 ("$out\sheet-{0:D2}-f{1:D3}-{2:D3}.jpg" -f $sheet, $chunk[0], $chunk[-1])
}
Get-ChildItem $out | ForEach-Object Name

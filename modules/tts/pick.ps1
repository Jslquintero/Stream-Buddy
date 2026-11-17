param([ValidateSet('model','piper')][string]$Kind)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object Windows.Forms.OpenFileDialog
$owner = New-Object Windows.Forms.Form
try {
    $owner.TopMost=$true; $owner.ShowInTaskbar=$false; $owner.Opacity=0; $owner.Show()
    if ($Kind -eq 'model') { $dialog.Filter='Modelo Piper|*.onnx'; $dialog.Title='Selecciona un modelo con su .onnx.json al lado' }
    else { $dialog.Filter='Piper|piper.exe'; $dialog.Title='Selecciona piper.exe (conserva toda su carpeta)' }
    $selected = ''
    if ($dialog.ShowDialog($owner) -eq 'OK') { $selected = $dialog.FileName }
    @{ path=$selected } | ConvertTo-Json -Compress
} finally { $dialog.Dispose(); $owner.Dispose() }

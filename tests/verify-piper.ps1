param([Parameter(Mandatory=$true)][string]$PiperExe,[Parameter(Mandatory=$true)][string]$JobDirectory)
$ErrorActionPreference='Stop'
$utf8=[Text.UTF8Encoding]::new($false)
foreach ($name in @('es_ES-davefx-medium','es_ES-sharvard-medium')) {
    $job=Get-Content -LiteralPath (Join-Path $JobDirectory "$name.job.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($adapted in @($false,$true)) {
        $suffix=if ($adapted) {'compatible'} else {'original'}
        $wav=Join-Path $JobDirectory "$name.$suffix.wav"
        if (Test-Path -LiteralPath $wav) { Remove-Item -LiteralPath $wav -Force }
        $info=New-Object Diagnostics.ProcessStartInfo
        $info.FileName=$PiperExe
        $info.Arguments='--model "'+$job.model+'" --output_file "'+$wav+'"'
        if ($adapted) {$info.Arguments+=' --config "'+$job.config+'"'}
        $info.UseShellExecute=$false; $info.CreateNoWindow=$true
        $info.RedirectStandardInput=$true; $info.RedirectStandardError=$true; $info.RedirectStandardOutput=$true
        $info.StandardErrorEncoding=$utf8
        $child=[Diagnostics.Process]::Start($info)
        try {
            $errors=$child.StandardError.ReadToEndAsync(); $output=$child.StandardOutput.ReadToEndAsync()
            $bytes=$utf8.GetBytes("Hola, bienvenidos al directo. Esta es una prueba de voz en castellano.`n")
            $child.StandardInput.BaseStream.Write($bytes,0,$bytes.Length); $child.StandardInput.Close()
            if (-not $child.WaitForExit(30000)) {$child.Kill();throw 'La sintesis excedio 30 segundos'}
            $size=if(Test-Path -LiteralPath $wav){(Get-Item -LiteralPath $wav).Length}else{0}
            if($adapted -and ($child.ExitCode -ne 0 -or $size -le 44)){throw $errors.Result}
            if(-not $adapted -and $errors.Result -notmatch 'not a single codepoint'){throw ('No se reprodujo el error esperado: '+$errors.Result)}
            [pscustomobject]@{Voice=$name;Config=$suffix;ExitCode=$child.ExitCode;WavBytes=$size}
        } finally {$child.Dispose()}
    }
}

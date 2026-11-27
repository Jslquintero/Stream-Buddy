$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$work = Join-Path $root '.tmp/desktop-build'
$assets = Join-Path $work 'downloads'
$app = Join-Path $root 'src-tauri/stage/app'
$binaries = Join-Path $root 'src-tauri/binaries'
$target = 'x86_64-pc-windows-msvc'

function Invoke-Checked {
    $program = $args[0]
    $arguments = @($args | Select-Object -Skip 1)
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "$program failed with exit code $LASTEXITCODE" }
}

function Get-Asset {
    param([string]$Url, [string]$Name, [string]$Sha256)
    $file = Join-Path $assets $Name
    if (!(Test-Path -LiteralPath $file) -or ($Sha256 -and (Get-FileHash -LiteralPath $file).Hash -ne $Sha256)) {
        Invoke-Checked curl.exe --fail --location --silent --show-error --retry 2 --max-time 300 --output "$file.part" $Url
        if ($Sha256 -and (Get-FileHash -LiteralPath "$file.part").Hash -ne $Sha256) { throw "Unexpected SHA256 for $Name" }
        Move-Item -LiteralPath "$file.part" -Destination $file -Force
    }
    return $file
}

Push-Location $root
try {
    $node = Get-Command node.exe -ErrorAction Stop
    $nodeArch = Invoke-Checked $node.Source -p process.arch
    if ($nodeArch -ne 'x64') { throw 'Stream Buddy requires x64 Node.js for this build.' }
    $python = if ($env:STUDIO_BUILD_PYTHON) { $env:STUDIO_BUILD_PYTHON } else { 'python.exe' }
    if (Test-Path -LiteralPath $app) {
        $resolvedApp = (Resolve-Path -LiteralPath $app).Path
        if ($resolvedApp -ne $app) { throw "Unexpected staging path: $resolvedApp" }
        Remove-Item -LiteralPath $resolvedApp -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $assets, $app, $binaries | Out-Null
    $env:TEMP = (New-Item -ItemType Directory -Force -Path "$work/temp").FullName
    $env:TMP = $env:TEMP

    Invoke-Checked npm.cmd run build
    Copy-Item -LiteralPath server.js,package.json,package-lock.json,backend,shared,dist -Destination $app -Recurse
    $modules = Join-Path $app 'modules'
    New-Item -ItemType Directory -Path "$modules/tts" | Out-Null
    Get-ChildItem -LiteralPath 'modules' -Directory | Where-Object Name -ne 'tts' | Copy-Item -Destination $modules -Recurse
    Get-ChildItem -LiteralPath 'modules/tts' -File | Copy-Item -Destination "$modules/tts"
    Invoke-Checked npm.cmd ci --prefix $app --omit=dev --ignore-scripts --no-audit --no-fund
    Copy-Item -LiteralPath $node.Source -Destination "$binaries/node-$target.exe" -Force
    $nodeVersion = Invoke-Checked $node.Source -p process.version
    $nodeLicense = Get-Asset "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" "node-$nodeVersion-LICENSE.txt"
    Copy-Item -LiteralPath $nodeLicense -Destination "$app/Node-LICENSE.txt"

    $venv = Join-Path $work 'python'
    $buildPython = Join-Path $venv 'Scripts/python.exe'
    if (!(Test-Path -LiteralPath $buildPython)) { Invoke-Checked $python -m venv $venv }
    $env:PYINSTALLER_CONFIG_DIR = Join-Path $work 'pyinstaller'
    Invoke-Checked $buildPython -m pip install --disable-pip-version-check -r scripts/desktop-requirements.txt
    Invoke-Checked $buildPython -m unittest discover -s tests -p '*_test.py'
    Invoke-Checked $buildPython -m PyInstaller --noconfirm --clean --onefile --console --noupx --name tiktok-bridge --distpath $work --workpath "$work/freeze" --specpath $work --collect-all TikTokLive --collect-all TikTokLiveProto --collect-all EulerApiSdk --recursive-copy-metadata TikTokLive modules/tts/bridge.py
    Invoke-Checked "$work/tiktok-bridge.exe" --self-test
    Copy-Item -LiteralPath "$work/tiktok-bridge.exe" -Destination "$binaries/tiktok-bridge-$target.exe" -Force
    Copy-Item -LiteralPath 'scripts/desktop-requirements.txt' -Destination "$modules/tts/desktop-requirements.txt"

    $pocket = "$modules/tts/tools/pocket-tts"
    $asset = 'pocket-tts-3.3.0-x86_64-pc-windows-msvc'
    $archive = Get-Asset "https://github.com/kyutai-labs/pocket-tts/releases/download/v4.0.1/$asset.zip" "$asset.zip" '98753041f2e65744b989776f87bccb93f1f574a08afe1890c5427ec94cd6309c'
    Expand-Archive -LiteralPath $archive -DestinationPath $work -Force
    New-Item -ItemType Directory -Path $pocket | Out-Null
    Copy-Item -LiteralPath "$work/$asset/pocket-tts.exe","$work/$asset/LICENSE" -Destination $pocket
    $hf = 'https://huggingface.co/kyutai/pocket-tts-without-voice-cloning/resolve'
    $weights = Get-Asset "$hf/1e08e6a23401048648a9fdcfde2f89348215c2a7/languages/spanish/model.safetensors?download=true" 'spanish-model.safetensors' 'c4988ff376692f2ab1e85b17350755b08f16e49c0b5f0de8b271efa9abd71de7'
    $voice = Get-Asset "$hf/a3055dcb533cf2ec90458008a01e7cef550bae2a/languages/spanish/embeddings/lola.safetensors?download=true" 'spanish-lola.safetensors' '967b8f08639345ff5ad1a912a5542fe421518c3f80b87d52078c6726348ab1e7'
    $tokenizer = Get-Asset "$hf/4e1e0a3e611c51c0b4ed8174fc10f32a54644303/languages/spanish/tokenizer.json" 'spanish-tokenizer.json' '9ade09bbdc64ab2b59952b90773fa0890b780ece4fd5aef0d36a00c6ad5f0531'
    $config = Get-Asset 'https://raw.githubusercontent.com/kyutai-labs/pocket-tts/v4.0.1/pocket_tts/config/spanish.yaml' 'spanish-v4.0.1.yaml' 'd1eac81523df1178c9c99dd311e49126cb7e55c02f198162bb90600b48efbf26'
    Copy-Item -LiteralPath $weights -Destination "$pocket/model.safetensors"
    Copy-Item -LiteralPath $voice -Destination "$pocket/lola.safetensors"
    Copy-Item -LiteralPath $tokenizer -Destination "$pocket/tokenizer.json"
    Copy-Item -LiteralPath 'scripts/pocket-model-notices.txt' -Destination $pocket
    $yaml = [IO.File]::ReadAllText($config) -replace '(?m)^weights_path: hf://[^\r\n]+', 'weights_path: model.safetensors' `
        -replace '(?m)^weights_path_without_voice_cloning: hf://[^\r\n]+\r?\n', '' `
        -replace '(?m)^    tokenizer_path: hf://[^\r\n]+', '    tokenizer_path: tokenizer.json'
    if ($yaml.Contains('hf://')) { throw 'The bundled model references remote files.' }
    [IO.File]::WriteAllText("$pocket/spanish.yaml", $yaml)

    . "$modules/tts/core.ps1"
    $preview = Join-Path $work 'preview.wav'
    Invoke-PocketSpeech -Executable "$pocket/pocket-tts.exe" -Voice 'lola' -Text 'Hola, Stream Buddy.' -Wav $preview
    Add-WavPlaybackPadding -Path $preview
} finally {
    Pop-Location
}

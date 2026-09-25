$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$nodeDirectory = Join-Path $runtimeRoot "node\bin"
$pnpmCommand = Join-Path $runtimeRoot "bin\fallback\pnpm.cmd"

if (-not (Test-Path (Join-Path $nodeDirectory "node.exe"))) {
  throw "Codex's bundled Node.js executable was not found at the expected runtime path."
}
if (-not (Test-Path $pnpmCommand)) {
  throw "Codex's bundled pnpm command was not found at the expected runtime path."
}

$env:PATH = "$nodeDirectory;$($env:PATH)"
Set-Location $projectRoot
$env:NEXT_PUBLIC_VAPI_PUBLIC_KEY = Read-Host "Enter NEXT_PUBLIC_VAPI_PUBLIC_KEY (browser-safe; leave blank to disable voice)"
$env:NEXT_PUBLIC_VAPI_ASSISTANT_ID = Read-Host "Enter NEXT_PUBLIC_VAPI_ASSISTANT_ID (leave blank to disable voice)"
$openAiSecureKey = Read-Host "Enter OPENAI_API_KEY (hidden; press Enter to run without investigation)" -AsSecureString
$openAiPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($openAiSecureKey)

try {
  $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($openAiPointer)
  Write-Host "Starting ResolveIT with Codex-bundled Node.js and pnpm. The OpenAI key is not written to disk."
  & $pnpmCommand dev
}
finally {
  Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_VAPI_PUBLIC_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_VAPI_ASSISTANT_ID -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($openAiPointer)
  Remove-Variable openAiSecureKey, openAiPointer -ErrorAction SilentlyContinue
}

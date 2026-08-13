$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  $env:RUBYOPT = '-r./scripts/jekyll-windows-paths.rb'
  bundle exec jekyll serve --host 127.0.0.1 --port 4000 --no-watch
}
finally {
  Pop-Location
}

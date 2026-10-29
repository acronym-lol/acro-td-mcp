$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
[System.Environment]::SetEnvironmentVariable('ACRO_TD_MCP', $ScriptDir, 'User')
$env:ACRO_TD_MCP = $ScriptDir
Write-Host "ACRO_TD_MCP set to $ScriptDir"

# The MCP server ships prebuilt in dist/index.js and only needs Node on PATH.
# After changing src/, rebuild with: npm install && npm run build

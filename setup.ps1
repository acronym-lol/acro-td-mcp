$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
[System.Environment]::SetEnvironmentVariable('ACRO_TD_MCP', $ScriptDir, 'User')
$env:ACRO_TD_MCP = $ScriptDir
Write-Host "ACRO_TD_MCP set to $ScriptDir"

# Note: npm install and build are handled by the parent project's setup.ps1
# When used standalone, run: npm install && npm run build from the project root

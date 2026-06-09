#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
launchctl setenv ACRO_TD_MCP "$SCRIPT_DIR"
if ! grep -q 'ACRO_TD_MCP' ~/.zshenv 2>/dev/null; then
    echo "export ACRO_TD_MCP=\"$SCRIPT_DIR\"" >> ~/.zshenv
fi
export ACRO_TD_MCP="$SCRIPT_DIR"
echo "ACRO_TD_MCP set to $SCRIPT_DIR"

# Note: npm install and build are handled by the parent project's setup.sh
# When used standalone, run: npm install && npm run build from the project root

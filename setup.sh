#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
launchctl setenv ACRO_TD_MCP "$SCRIPT_DIR"
# Drop any earlier line (e.g. from before the repo moved), then add the current path
if [ -f ~/.zshenv ]; then sed -i.bak '/^export ACRO_TD_MCP=/d' ~/.zshenv && rm -f ~/.zshenv.bak; fi
echo "export ACRO_TD_MCP=\"$SCRIPT_DIR\"" >> ~/.zshenv
export ACRO_TD_MCP="$SCRIPT_DIR"
echo "ACRO_TD_MCP set to $SCRIPT_DIR"

# The MCP server ships prebuilt in dist/index.js and only needs Node on PATH.
# After changing src/, rebuild with: npm install && npm run build

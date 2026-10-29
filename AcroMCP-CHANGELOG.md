# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-10-29
- Requests need the per-session token from the instance registry and must come from this machine with no Origin; POST bodies must be JSON. Port choice skips OS-reserved ports, and a reload keeps the port and token.

## [1.0.5] - 2026-06-09
- Updated changelog and version paths 

## [1.0.3] - 2026-03-25
- Add on exit to clean up old instances in temp file

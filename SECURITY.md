# Security Policy

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue for a
vulnerability.

- Preferred: [GitHub private vulnerability reporting](https://github.com/rubicon/career-ops-plugin-docx/security/advisories/new).
- Fallback: email dax@rubicontv.com.

Please include the version, a description of the issue, and steps to reproduce
it. You can expect an acknowledgement within a few days.

## What to include

- The plugin version (see `package.json` or `manifest.json`).
- A clear description of the problem and its impact.
- Reproduction steps, and a proof of concept if you have one.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Scope

This plugin runs locally and has no network access and no runtime dependencies.
The most relevant surface is the handling of the CV file path and the output
path (both are contained to the project directory). Reports about path handling,
or about malformed input causing unexpected file writes, are in scope.

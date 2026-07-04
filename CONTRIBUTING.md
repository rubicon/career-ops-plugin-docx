# Contributing

Thanks for your interest in improving career-ops-plugin-docx.

## Development setup

You need Node 18 or newer.

```bash
npm install          # dev tooling only; the plugin itself has no runtime dependencies
npm test             # zero-network smoke test
npm run format:check # Prettier
```

The plugin must stay dependency-free at runtime. The career-ops plugin registry
rejects any bare (npm) import in plugin source: use relative modules and the
allowlisted Node built-ins only (no network, no `child_process`). If you add a
source file, keep to that rule. `npm test` and the registry audit both check it.

## Before you open a PR

Run these and make sure they pass:

```bash
npm test
npm run format:check
```

## Issues and branches

Open an issue before starting non-trivial work, so the approach can be agreed on
first. Branch names follow `dev/<issue-number>-<short-kebab-description>`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
`fix:`, `docs:`, `chore:`, and so on). Commit messages are linted in CI. Do not
add AI-authorship trailers.

## Pull requests

Keep a PR scoped to one issue. Fill in the PR template, link the issue, and make
sure CI is green. Describe what changed and how you verified it.

## Scope

This plugin does one thing: turn `cv.md` into a Word `.docx`. It is
human-in-the-loop and never submits anything anywhere. Please keep changes
within that scope. Styling that is specific to one person's brand belongs in a
fork, not here; the export stays generic and ATS-friendly.

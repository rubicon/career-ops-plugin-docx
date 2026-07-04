# Agent Instructions

This is the canonical instruction file for AI coding agents working in this
repository. `AGENTS.md` is a pointer to this file.

## What this project is

career-ops-plugin-docx is a [career-ops](https://github.com/santifer/career-ops)
plugin that exports a Markdown CV (`cv.md`) to a Word `.docx`. It is small,
local, and single-purpose. Its reason to exist is the `####` nested sub-role:
a `###` company/umbrella entry holds several `####` client engagements
(fractional, interim, umbrella work) instead of flattening them into separate jobs.

See `ARCHITECTURE.md` for the layout and data flow. Entry points: `index.mjs`
(the `export` hook), `lib/cv-docx.mjs` (parser + OOXML renderer), `lib/zip.mjs`
(dependency-free ZIP writer), `bin/generate-docx.mjs` (standalone CLI).

## Non-negotiable invariants

- **Dependency-free at runtime.** The career-ops plugin registry rejects any
  bare (npm) import in plugin source. Use relative modules and the allowlisted
  Node built-ins only (`node:fs`, `node:path`, `node:zlib`, `node:buffer`,
  `node:crypto`, `node:url`, `node:util`, `node:assert`, and the rest of the
  allowlist). No network, no `child_process`, no `worker_threads`, no `eval`.
- **Human-in-the-loop.** The plugin writes a document you review. It never
  submits anything anywhere. `manifest.json` keeps `humanInTheLoop: true`.
- **Generic output.** The export is theme-free and ATS-friendly. Person-specific
  branding (colors, pills, a styled letterhead) belongs in a fork, not here.
- **No personal data in the repo.** Tests and examples use the non-personal
  fixture only (`examples/cv-fractional-example.md`). Never commit a real CV.
- **Contained file access.** `cv_path` and `output_dir` are resolved and checked
  to stay inside the project directory. Keep that guard.

## Commands

- `npm test` runs the zero-network smoke test (parser, nested sub-roles, output validity, determinism).
- `npm run format:check` / `npm run format` (Prettier).
- In career-ops: `node plugins.mjs run docx export [--dry-run]` writes `output/cv-<name>.docx`.
- Standalone: `npm run cv -- <input.md> <output.docx> [--format=letter|a4]` (wraps `bin/generate-docx.mjs`).

## Working conventions

- Conventional Commits; commit messages are linted in CI.
- No AI-authorship trailers, no "Generated with" lines. No em-dashes, no emojis
  in code, comments, docs, commits, issues, or PRs.
- Run `npm test` (the zero-network smoke test) and `npm run format:check` before
  opening a PR. The smoke test covers hierarchy parsing, nested sub-role
  rendering, standard-role rendering, and output validity.
- Keep the parser (`parseCvMarkdown`) and the OOXML renderer separate.

## Fixtures

`examples/cv-fractional-example.md` is the canonical test input. It exercises the
`####` nested sub-role convention (an advisory umbrella with several client
engagements) as well as ordinary roles. Extend it rather than adding a real CV.

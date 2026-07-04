# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-03

### Added

- Word `.docx` export for career-ops, generated directly from `cv.md` through the plugin `export` hook.
- Support for the `cv.md` heading hierarchy: `##` sections, `###` company/role entries, and `####` nested sub-roles for fractional, interim, and umbrella engagements.
- Standalone CLI (`bin/generate-docx.mjs`) for exporting any Markdown CV outside career-ops.
- Configurable `cv_path`, `output_dir`, and `format` (a4 or letter) settings.
- Dependency-free OOXML engine (relative modules plus Node built-ins only) and a zero-network smoke test.
- A non-personal example CV at `examples/cv-fractional-example.md`.

[Unreleased]: https://github.com/rubicon/career-ops-plugin-docx/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rubicon/career-ops-plugin-docx/releases/tag/v0.1.0
